package com.opentelecrm.feature.dialer

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.model.DialerCandidate
import com.opentelecrm.core.model.Dispositions
import com.opentelecrm.feature.dialer.data.DialerRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * M3 dialer call pad: loads the next candidate, places the call, polls the
 * call record until it ends, then drives disposition capture.
 *
 * The live call session is mirrored into the singleton [CallSession] object so
 * the sibling CallForegroundService can observe/update the same call.
 */
@HiltViewModel
class DialerViewModel @Inject constructor(
    private val repository: DialerRepository,
    @dagger.hilt.android.qualifiers.ApplicationContext private val context: android.content.Context,
) : ViewModel() {

    data class DialerUiState(
        val candidate: DialerCandidate? = null,
        val loading: Boolean = true,
        val dialing: Boolean = false,
        val inCall: CallState? = null,
        val error: String? = null,
        val dispositionNote: String? = null,
        val permissionGranted: Boolean = false,
    )

    private val _uiState = MutableStateFlow(DialerUiState())
    val uiState: StateFlow<DialerUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null
    private var loadInProgress = false

    init {
        viewModelScope.launch {
            CallSession.state.collect { call ->
                _uiState.update { it.copy(inCall = call) }
            }
        }
        loadNext()
    }

    /** Pulls the next candidate from the dialer queue. */
    fun loadNext() {
        if (loadInProgress || _uiState.value.dialing) return
        if (CallSession.state.value.isActive()) return
        loadInProgress = true
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val candidate = repository.next()
                _uiState.update { it.copy(candidate = candidate, loading = false) }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(loading = false, error = e.message ?: "Could not load the next candidate")
                }
            } finally {
                loadInProgress = false
            }
        }
    }

    /**
     * Dials the current candidate. On success activates [CallSession] and
     * starts a 5s poll loop over the call record; the loop stops when the call
     * has an `endedAt` or its status leaves queued/running, then marks the call
     * ended so the UI shows the disposition sheet.
     */
    fun dial() {
        val candidate = _uiState.value.candidate ?: return
        if (_uiState.value.dialing) return
        if (CallSession.state.value.activeCallId != null) return
        viewModelScope.launch {
            _uiState.update { it.copy(dialing = true, error = null) }
            try {
                val response = repository.dial(candidate.leadId)
                val callId = response.id ?: response.callId
                if (callId == null) {
                    _uiState.update {
                        it.copy(dialing = false, error = "Server did not return a call id")
                    }
                    return@launch
                }
                CallSession.update {
                    it.copy(
                        candidate = candidate,
                        leadId = candidate.leadId,
                        activeCallId = callId,
                        callStatus = "queued",
                        startedAt = java.time.Instant.now().toString(),
                        endedAt = null,
                    )
                }
                // M3: foreground service shows the active-call notification.
                CallForegroundService.start(
                    context,
                    leadPhone = candidate.phone ?: candidate.identifier ?: "",
                    leadName = candidate.leadId,
                    callId = callId,
                )
                _uiState.update { it.copy(dialing = false) }
                pollUntilEnded(callId)
            } catch (e: Exception) {
                _uiState.update { it.copy(dialing = false, error = e.message ?: "Dial failed") }
            }
        }
    }

    /** Ends the call locally (mock provider auto-ends) and surfaces the disposition sheet. */
    fun endCall() {
        val call = CallSession.state.value
        if (!call.isActive()) return
        pollJob?.cancel()
        CallSession.update {
            it.copy(callStatus = "ended", endedAt = it.endedAt ?: Instant.now().toString())
        }
    }

    /** Saves the disposition for the ended call, then advances to the next candidate. */
    fun submitDisposition(disposition: String) {
        val leadId = CallSession.state.value.leadId ?: _uiState.value.candidate?.leadId ?: return
        val note = _uiState.value.dispositionNote?.trim()?.takeIf { it.isNotEmpty() }
        viewModelScope.launch {
            try {
                repository.disposition(leadId, disposition, note)
                completeCall()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Could not save disposition") }
            }
        }
    }

    /** Skips the current candidate. */
    fun skip() {
        val candidate = _uiState.value.candidate ?: return
        if (_uiState.value.dialing) return
        if (CallSession.state.value.activeCallId != null) return
        viewModelScope.launch {
            try {
                repository.skip(candidate.leadId)
                loadNext()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Could not skip candidate") }
            }
        }
    }

    /**
     * Creates a callback row for the ended call (only used when the chosen
     * disposition is "callback"), records the callback disposition, and
     * advances to the next candidate.
     */
    fun scheduleCallback(quickChip: String) {
        val leadId = CallSession.state.value.leadId ?: _uiState.value.candidate?.leadId ?: return
        val note = _uiState.value.dispositionNote?.trim()?.takeIf { it.isNotEmpty() }
        viewModelScope.launch {
            try {
                repository.scheduleCallback(leadId, quickChip, note)
                repository.disposition(leadId, Dispositions.CALLBACK, note)
                completeCall()
            } catch (e: Exception) {
                _uiState.update { it.copy(error = e.message ?: "Could not schedule callback") }
            }
        }
    }

    fun setPermissionGranted(granted: Boolean) {
        _uiState.update { it.copy(permissionGranted = granted) }
    }

    fun onDispositionNoteChange(note: String) {
        _uiState.update { it.copy(dispositionNote = note) }
    }

    /** Polls the call record every 5s until it ends; marks it ended on completion. */
    private fun pollUntilEnded(callId: String) {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            var attempts = 0
            while (attempts < MAX_POLL_ATTEMPTS && isActive) {
                delay(POLL_INTERVAL_MS)
                attempts++
                val record = try {
                    repository.callState(callId)
                } catch (e: Exception) {
                    null // transient failure — keep polling
                }
                if (record == null) continue
                CallSession.update {
                    it.copy(
                        callStatus = record.status ?: it.callStatus,
                        startedAt = record.startedAt ?: it.startedAt,
                        endedAt = record.endedAt ?: it.endedAt,
                    )
                }
                val status = record.status?.lowercase()
                val ended = record.endedAt != null || (status != null && status !in ACTIVE_STATUSES)
                if (ended) {
                    // Mock provider may never stamp endedAt — mark it locally so the
                    // disposition sheet appears.
                    val current = CallSession.state.value
                    if (current.endedAt == null) {
                        CallSession.update {
                            it.copy(callStatus = "ended", endedAt = Instant.now().toString())
                        }
                    }
                    return@launch
                }
            }
        }
    }

    /** Clears the session/note and advances the queue. */
    private fun completeCall() {
        pollJob?.cancel()
        CallSession.reset()
        CallForegroundService.stop(context)
        _uiState.update { it.copy(dispositionNote = null) }
        loadNext()
    }

    private companion object {
        const val POLL_INTERVAL_MS = 5_000L
        const val MAX_POLL_ATTEMPTS = 360 // 30 minutes of 5s polls, safety cap
        val ACTIVE_STATUSES = setOf("queued", "running")
    }
}
