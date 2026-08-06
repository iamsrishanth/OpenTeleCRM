package com.opentelecrm.feature.leads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.model.TeamMember
import com.opentelecrm.feature.leads.data.LeadsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** M1 team roster screen state. */
data class TeamUiState(
    val members: List<TeamMember> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
)

/** Loads the team roster from the leads repository. */
@HiltViewModel
class TeamViewModel @Inject constructor(
    private val repository: LeadsRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(TeamUiState())
    val uiState: StateFlow<TeamUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    /** Fetches team members; surfaces failures via [TeamUiState.error]. */
    fun load() {
        _uiState.value = _uiState.value.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val members = repository.teamMembers()
                _uiState.value = TeamUiState(members = members, loading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(
                    loading = false,
                    error = e.message ?: "Could not load team members",
                )
            }
        }
    }

    /** Re-runs the initial load after an error. */
    fun retry() = load()
}
