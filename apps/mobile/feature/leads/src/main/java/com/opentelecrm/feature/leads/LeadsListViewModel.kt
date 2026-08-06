package com.opentelecrm.feature.leads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.TeamMember
import com.opentelecrm.core.sync.ConnectivityObserver
import com.opentelecrm.feature.leads.data.ActionsRepository
import com.opentelecrm.feature.leads.data.LeadsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * M1 leads list: Room cache as source of truth, client-side search + team
 * filter on top of the cached list, pull-to-refresh via [LeadsRepository.refresh].
 */
@HiltViewModel
class LeadsListViewModel @Inject constructor(
    private val repository: LeadsRepository,
    private val sessionManager: SessionManager,
    private val connectivityObserver: ConnectivityObserver,
    private val actionsRepository: ActionsRepository,
) : ViewModel() {

    data class LeadsUiState(
        val query: String = "",
        val leads: List<LeadSummary> = emptyList(),
        val loading: Boolean = true,
        val refreshing: Boolean = false,
        val error: String? = null,
        val syncedCount: Int? = null,
        val teamFilter: String? = null,
        val isOnline: Boolean = true,
        val pendingCount: Int = 0,
    )

    private val _uiState = MutableStateFlow(LeadsUiState())
    val uiState: StateFlow<LeadsUiState> = _uiState.asStateFlow()

    /** Unfiltered cached list — the source for client-side query/team filtering. */
    private val allLeads = MutableStateFlow<List<LeadSummary>>(emptyList())

    init {
        viewModelScope.launch {
            repository.leads.collect { leads ->
                allLeads.value = leads
                publish()
            }
        }
        viewModelScope.launch {
            connectivityObserver.isOnline.collect { online ->
                _uiState.update { it.copy(isOnline = online) }
            }
        }
        viewModelScope.launch {
            actionsRepository.pendingCount.collect { count ->
                _uiState.update { it.copy(pendingCount = count) }
            }
        }
        refresh()
    }

    /** Filters the cached list client-side; the Room flow keeps it in sync after syncs. */
    fun onQueryChange(value: String) {
        _uiState.update { it.copy(query = value) }
        publish()
    }

    /** Filters leads by owner agent id; null clears the filter. */
    fun setTeamFilter(agentId: String?) {
        _uiState.update { it.copy(teamFilter = agentId) }
        publish()
    }

    /** Pulls changed leads from the API and updates the sync count; surfaces errors. */
    fun refresh() {
        if (_uiState.value.refreshing) return
        if (sessionManager.session.value == null) {
            _uiState.update { it.copy(loading = false, error = "Not signed in — cannot sync leads") }
            return
        }
        viewModelScope.launch {
            _uiState.update { it.copy(refreshing = true, error = null) }
            try {
                val count = repository.refresh()
                _uiState.update {
                    it.copy(
                        loading = false,
                        refreshing = false,
                        error = null,
                        syncedCount = count,
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        loading = false,
                        refreshing = false,
                        error = e.message ?: "Sync failed",
                    )
                }
            }
        }
    }

    /**
     * Retries queued changes now — same path as a manual refresh. The outbox
     * WorkManager worker also flushes automatically on reconnect.
     */
    fun retrySync() {
        refresh()
    }

    /** Team members for the filter chips (suspend — screen loads them on first composition). */
    suspend fun teamMembers(): List<TeamMember> = repository.teamMembers()

    private fun publish() {
        val state = _uiState.value
        val query = state.query.trim().lowercase()
        val agentId = state.teamFilter
        val filtered = allLeads.value.filter { lead ->
            (agentId == null || lead.ownerUserId == agentId) &&
                (query.isEmpty() || matchesQuery(lead, query))
        }
        _uiState.update { it.copy(leads = filtered) }
    }

    private fun matchesQuery(lead: LeadSummary, query: String): Boolean {
        val haystack = buildString {
            lead.identifier?.let { append(it).append(' ') }
            lead.customFieldString("name")?.let { append(it).append(' ') }
            lead.customFieldString("city")?.let { append(it).append(' ') }
        }
        return haystack.lowercase().contains(query)
    }
}
