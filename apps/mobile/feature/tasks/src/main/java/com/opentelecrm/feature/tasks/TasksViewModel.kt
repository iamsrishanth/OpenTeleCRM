package com.opentelecrm.feature.tasks

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.database.TaskEntity
import com.opentelecrm.feature.tasks.data.TasksRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TasksUiState(
    val tasks: List<TaskEntity> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val busyId: String? = null,
)

@HiltViewModel
class TasksViewModel @Inject constructor(
    private val repository: TasksRepository,
) : ViewModel() {

    private val loading = MutableStateFlow(true)
    private val error = MutableStateFlow<String?>(null)
    private val busyId = MutableStateFlow<String?>(null)

    val uiState: StateFlow<TasksUiState> =
        combine(repository.tasks, loading, error, busyId) { tasks, loading, error, busy ->
            TasksUiState(tasks, loading, error, busy)
        }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TasksUiState())

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            loading.value = true
            error.value = null
            try {
                repository.refresh()
            } catch (t: Throwable) {
                error.value = t.message ?: "Failed to load tasks"
            } finally {
                loading.value = false
            }
        }
    }

    fun createTask(title: String, description: String?, priority: String?, dueDate: String?) {
        viewModelScope.launch {
            error.value = null
            try {
                repository.create(title, description, priority, dueDate)
            } catch (t: Throwable) {
                error.value = t.message ?: "Failed to create task"
            }
        }
    }

    fun updateStatus(taskId: String, status: String) {
        viewModelScope.launch {
            busyId.value = taskId
            error.value = null
            try {
                repository.updateStatus(taskId, status)
            } catch (t: Throwable) {
                error.value = t.message ?: "Failed to update task"
            } finally {
                busyId.value = null
            }
        }
    }
}
