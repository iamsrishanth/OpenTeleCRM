package com.opentelecrm.feature.leads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.model.ActionSummary
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.TeamMember
import com.opentelecrm.core.sync.ActionOutbox
import com.opentelecrm.feature.leads.data.ActionsRepository
import com.opentelecrm.feature.leads.data.LeadsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** UI state for the M2 lead detail screen (lead info + action timeline). */
data class LeadDetailUiState(
    val lead: LeadSummary? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val ownerName: String? = null,
    val timeline: List<ActionSummary> = emptyList(),
    val timelineLoading: Boolean = false,
    val actionError: String? = null,
    val composing: Boolean = false,
    val pendingCount: Int = 0,
)

/**
 * Loads a single lead for the detail screen: instant Room-cache read so the
 * screen has content immediately, then a delta refresh to pick up changes and
 * a re-read of the cache. Resolves the lead's owner user id to a display name
 * from the team list (fetched once and cached in the VM).
 *
 * M2: also observes the lead's action timeline (cache-first, refreshed from the
 * API) and submits notes/call/whatsapp actions through [ActionsRepository],
 * surfacing offline-queued or rejected outcomes via [LeadDetailUiState.actionError].
 */
@HiltViewModel
class LeadDetailViewModel @Inject constructor(
    private val repository: LeadsRepository,
    private val actionsRepository: ActionsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeadDetailUiState())
    val uiState: StateFlow<LeadDetailUiState> = _uiState.asStateFlow()

    /** Cached team list so the owner name is resolved without repeated network calls. */
    private var teamCache: List<TeamMember>? = null

    /** Collects the active lead's timeline from the Room cache into [LeadDetailUiState.timeline]. */
    private var timelineJob: Job? = null

    init {
        viewModelScope.launch {
            actionsRepository.pendingCount.collect { count ->
                _uiState.value = _uiState.value.copy(pendingCount = count)
            }
        }
    }

    fun load(leadId: String) {
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                // 1. Instant read from the cache so the screen has content immediately.
                repository.cachedLead(leadId)?.let { cached ->
                    _uiState.value = _uiState.value.copy(
                        lead = cached,
                        loading = false,
                        ownerName = resolveOwnerName(cached),
                    )
                }

                // 2. Refresh the cache, then re-read to surface the freshest copy.
                repository.refresh()
                val fresh = repository.cachedLead(leadId)
                _uiState.value = if (fresh != null) {
                    _uiState.value.copy(
                        lead = fresh,
                        loading = false,
                        error = null,
                        ownerName = resolveOwnerName(fresh),
                    )
                } else {
                    _uiState.value.copy(lead = null, loading = false, error = null)
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    loading = false,
                    error = e.message ?: "Failed to load lead",
                )
            }
        }
    }

    /**
     * Re-points the timeline observer at [leadId] and pulls the latest actions
     * from the API into the Room cache (which the observer then re-emits).
     */
    fun refreshTimeline(leadId: String) {
        timelineJob?.cancel()
        timelineJob = viewModelScope.launch {
            actionsRepository.timeline(leadId).collect { list ->
                _uiState.value = _uiState.value.copy(timeline = list)
            }
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(timelineLoading = true)
            try {
                actionsRepository.refreshTimeline(leadId)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    actionError = e.message ?: "Failed to refresh timeline",
                )
            } finally {
                _uiState.value = _uiState.value.copy(timelineLoading = false)
            }
        }
    }

    fun addNote(leadId: String, text: String) {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return
        submitAction(leadId, type = "note", note = trimmed)
    }

    fun logCall(leadId: String) = submitAction(leadId, type = "call", note = "Call logged")

    fun logWhatsApp(leadId: String) =
        submitAction(leadId, type = "whatsapp", note = "WhatsApp message sent")

    private fun submitAction(leadId: String, type: String, note: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(composing = true, actionError = null)
            val result = try {
                actionsRepository.createAction(leadId, type, note)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    composing = false,
                    actionError = e.message ?: "Failed to save action",
                )
                return@launch
            }
            when (result) {
                is ActionOutbox.CreateResult.Success -> Unit
                is ActionOutbox.CreateResult.Queued ->
                    _uiState.value = _uiState.value.copy(actionError = "Saved offline — will sync")
                is ActionOutbox.CreateResult.Rejected ->
                    _uiState.value = _uiState.value.copy(actionError = result.reason)
            }
            _uiState.value = _uiState.value.copy(composing = false)
            refreshTimeline(leadId)
        }
    }

    private suspend fun resolveOwnerName(lead: LeadSummary): String? {
        val ownerId = lead.ownerUserId ?: return null
        if (teamCache == null) {
            // Never let the team fetch break the cache-first path (offline).
            teamCache = try {
                repository.teamMembers()
            } catch (e: Exception) {
                emptyList()
            }
        }
        return teamCache?.firstOrNull { it.id == ownerId }?.name
    }
}
