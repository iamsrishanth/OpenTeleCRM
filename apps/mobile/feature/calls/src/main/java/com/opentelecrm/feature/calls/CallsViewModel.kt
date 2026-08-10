package com.opentelecrm.feature.calls

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.database.DeviceCallEntity
import com.opentelecrm.feature.calls.data.DeviceCallsRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CallsUiState(
    val recent: List<DeviceCallEntity> = emptyList(),
    val unsyncedCount: Int = 0,
    val importedCount: Int = 0,
    val error: String? = null,
)

@HiltViewModel
class CallsViewModel @Inject constructor(
    private val repository: DeviceCallsRepository,
) : ViewModel() {

    private val importedCount = MutableStateFlow(0)
    private val error = MutableStateFlow<String?>(null)

    val uiState: StateFlow<CallsUiState> =
        combine(repository.recent, repository.unsyncedCount, importedCount, error) { recent, unsynced, imported, err ->
            CallsUiState(recent, unsynced, imported, err)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CallsUiState())

    fun importFromDevice() {
        viewModelScope.launch {
            error.value = null
            val n = repository.importFromDevice()
            importedCount.value = n
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            error.value = null
            try {
                repository.sync()
            } catch (t: Throwable) {
                error.value = t.message ?: "Sync failed"
            }
        }
    }
}
