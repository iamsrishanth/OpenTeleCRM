package com.opentelecrm.feature.eod

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.database.EodEntity
import com.opentelecrm.feature.eod.data.EodRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * M4 EOD report: Room cache as source of truth. Submit posts to the API and
 * upserts the returned row so the history flow updates immediately.
 */
@HiltViewModel
class EodViewModel @Inject constructor(
    private val repository: EodRepository,
) : ViewModel() {

    data class EodUiState(
        val summary: String = "",
        val hours: String = "",
        val history: List<EodEntity> = emptyList(),
        val busy: Boolean = false,
        val error: String? = null,
        val submitted: Boolean = false,
    )

    private val _uiState = MutableStateFlow(EodUiState())
    val uiState: StateFlow<EodUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.eodReports.collect { rows ->
                _uiState.update { it.copy(history = rows) }
            }
        }
        refresh()
    }

    fun onSummaryChange(value: String) {
        _uiState.update { it.copy(summary = value, error = null, submitted = false) }
    }

    fun onHoursChange(value: String) {
        _uiState.update { it.copy(hours = value, error = null, submitted = false) }
    }

    /** Validates (summary required, hours numeric) and submits; clears the form on success. */
    fun submit() {
        if (_uiState.value.busy) return
        val summary = _uiState.value.summary.trim()
        if (summary.isEmpty()) {
            _uiState.update { it.copy(error = "Summary is required") }
            return
        }
        val hoursText = _uiState.value.hours.trim()
        val hours = if (hoursText.isEmpty()) null else hoursText.toDoubleOrNull()
        if (hoursText.isNotEmpty() && hours == null) {
            _uiState.update { it.copy(error = "Hours must be a number") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null, submitted = false) }
            try {
                repository.submit(summary, hours)
                _uiState.update { it.copy(busy = false, submitted = true, summary = "", hours = "") }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _uiState.update { it.copy(busy = false, error = e.message ?: "Submit failed") }
            }
        }
    }

    /** Pulls EOD history from the API into the Room cache. */
    fun refresh() {
        viewModelScope.launch {
            try {
                repository.refresh()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Offline / not signed in — the cached history stays visible.
            }
        }
    }
}
