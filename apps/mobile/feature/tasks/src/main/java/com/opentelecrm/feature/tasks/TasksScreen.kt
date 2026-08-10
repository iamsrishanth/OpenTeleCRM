package com.opentelecrm.feature.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.database.TaskEntity
import com.opentelecrm.core.designsystem.AppTheme

private val STATUSES = listOf("todo", "in_progress", "blocked", "done")
private val PRIORITIES = listOf("low", "medium", "high")

@Composable
fun TasksRoute(
    onBack: () -> Unit,
    viewModel: TasksViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    TasksScreen(uiState, onBack, viewModel::refresh, viewModel::createTask, viewModel::updateStatus)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TasksScreen(
    uiState: TasksUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onCreate: (String, String?, String?, String?) -> Unit,
    onStatus: (String, String) -> Unit,
) {
    var showNew by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Tasks") },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("←") }
                },
                actions = {
                    TextButton(onClick = onRefresh) { Text("Refresh") }
                    Button(onClick = { showNew = true }) { Text("New") }
                },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (uiState.loading) {
                CircularProgressIndicator(Modifier.align(Alignment.CenterHorizontally).padding(32.dp))
            } else if (uiState.tasks.isEmpty()) {
                Text("No tasks yet", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(vertical = 24.dp))
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(uiState.tasks, key = { it.id }) { task ->
                        TaskCard(task, uiState.busyId == task.id) { status -> onStatus(task.id, status) }
                    }
                }
            }
            uiState.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }

    if (showNew) {
        NewTaskDialog(
            onDismiss = { showNew = false },
            onCreate = { title, desc, priority, due ->
                onCreate(title, desc, priority, due)
                showNew = false
            },
        )
    }
}

@Composable
private fun TaskCard(task: TaskEntity, busy: Boolean, onStatus: (String) -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(task.title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                Text(
                    task.priority,
                    style = MaterialTheme.typography.labelSmall,
                    color = when (task.priority) {
                        "high" -> MaterialTheme.colorScheme.error
                        "low" -> MaterialTheme.colorScheme.outline
                        else -> MaterialTheme.colorScheme.primary
                    },
                )
            }
            task.description?.takeIf { it.isNotBlank() }?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                StatusDropdown(task.status, busy) { onStatus(it) }
                Spacer16()
                task.dueDate?.let {
                    Text("Due $it", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatusDropdown(current: String, busy: Boolean, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { if (!busy) expanded = it }) {
        OutlinedTextField(
            value = current.replace('_', ' '),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(0.45f),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            STATUSES.forEach { status ->
                DropdownMenuItem(
                    text = { Text(status.replace('_', ' ')) },
                    onClick = {
                        expanded = false
                        if (status != current) onSelect(status)
                    },
                )
            }
        }
    }
}

@Composable
private fun ExposedDropdownMenu(
    expanded: Boolean,
    onDismissRequest: () -> Unit,
    content: @Composable () -> Unit,
) {
    androidx.compose.material3.DropdownMenu(expanded = expanded, onDismissRequest = onDismissRequest) { content() }
}

@Composable
private fun NewTaskDialog(
    onDismiss: () -> Unit,
    onCreate: (String, String?, String?, String?) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var priority by remember { mutableStateOf("medium") }
    var dueDate by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Task") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("Title") }, singleLine = true)
                OutlinedTextField(description, { description = it }, label = { Text("Description (optional)") })
                PriorityDropdown(priority) { priority = it }
                OutlinedTextField(dueDate, { dueDate = it }, label = { Text("Due date YYYY-MM-DD (optional)") }, singleLine = true)
            }
        },
        confirmButton = {
            Button(onClick = { onCreate(title.trim(), description.trim().takeIf { it.isNotEmpty() }, priority, dueDate.trim().takeIf { it.isNotEmpty() }) }) {
                Text("Create")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PriorityDropdown(current: String, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
        OutlinedTextField(
            value = current,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier.menuAnchor().fillMaxWidth(),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            PRIORITIES.forEach { p ->
                DropdownMenuItem(text = { Text(p) }, onClick = { expanded = false; onSelect(p) })
            }
        }
    }
}

@Composable
private fun Spacer16() = androidx.compose.foundation.layout.Spacer(Modifier.padding(start = 8.dp))
