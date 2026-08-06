package com.opentelecrm.feature.leads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.TeamMember
import com.opentelecrm.feature.leads.data.LeadsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** UI state for the M1 lead detail screen. */
data class LeadDetailUiState(
    val lead: LeadSummary? = null,
    val loading: Boolean = false,
    val error: String? = null,
    val ownerName: String? = null,
)

/**
 * Loads a single lead for the detail screen: instant Room-cache read so the
 * screen has content immediately, then a delta refresh to pick up changes and
 * a re-read of the cache. Resolves the lead's owner user id to a display name
 * from the team list (fetched once and cached in the VM).
 */
@HiltViewModel
class LeadDetailViewModel @Inject constructor(
    private val repository: LeadsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeadDetailUiState())
    val uiState: StateFlow<LeadDetailUiState> = _uiState.asStateFlow()

    /** Cached team list so the owner name is resolved without repeated network calls. */
    private var teamCache: List<TeamMember>? = null

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

    private suspend fun resolveOwnerName(lead: LeadSummary): String? {
        val ownerId = lead.ownerUserId ?: return null
        if (teamCache == null) {
            teamCache = repository.teamMembers()
        }
        return teamCache?.firstOrNull { it.id == ownerId }?.name
    }
}
