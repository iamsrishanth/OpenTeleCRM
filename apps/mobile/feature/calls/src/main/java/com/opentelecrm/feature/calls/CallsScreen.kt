package com.opentelecrm.feature.calls

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.database.DeviceCallEntity

@Composable
fun CallsRoute(
    onBack: () -> Unit,
    viewModel: CallsViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    CallsScreen(uiState, onBack, viewModel::importFromDevice, viewModel::syncNow)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CallsScreen(
    uiState: CallsUiState,
    onBack: () -> Unit,
    onImport: () -> Unit,
    onSync: () -> Unit,
) {
    val context = LocalContext.current
    var hasPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        hasPermission = granted
        if (granted) onImport()
    }

    LaunchedEffect(Unit) {
        if (hasPermission) onImport()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Device Calls") },
                navigationIcon = { TextButton(onClick = onBack) { Text("←") } },
                actions = { TextButton(onClick = onSync) { Text("Sync") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            Card(Modifier.fillMaxWidth()) {
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                    Stat("Unsynced", uiState.unsyncedCount.toString())
                    Stat("Imported", uiState.importedCount.toString())
                }
            }
            Row(Modifier.padding(vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!hasPermission) {
                    OutlinedButton(onClick = { permissionLauncher.launch(Manifest.permission.READ_CALL_LOG) }) {
                        Text("Grant call-log access")
                    }
                } else {
                    OutlinedButton(onClick = onImport) { Text("Import device calls") }
                }
                Button(onClick = onSync) { Text("Sync now") }
            }
            uiState.error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                items(uiState.recent, key = { it.localId }) { call ->
                    CallRow(call)
                }
            }
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column {
        Text(value, style = MaterialTheme.typography.titleLarge)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CallRow(call: DeviceCallEntity) {
    Card(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                call.callType,
                color = when (call.callType) {
                    "incoming" -> MaterialTheme.colorScheme.primary
                    "outgoing" -> MaterialTheme.colorScheme.tertiary
                    else -> MaterialTheme.colorScheme.error
                },
                style = MaterialTheme.typography.labelSmall,
            )
            Text(call.phoneNumber, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            Text("${call.durationSec}s", style = MaterialTheme.typography.labelSmall)
        }
        Text(
            "${call.simSlot ?: "—"} · ${call.startedAt.take(16).replace('T', ' ')}",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
        )
    }
}
