package com.opentelecrm.feature.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import kotlinx.coroutines.launch

/**
 * Server settings: change the workspace URL, verify connectivity, revert or reset.
 *
 * @param onSaved invoked after a server change is saved; the host may return
 * to onboarding/login since switching servers signs the user out.
 */
@Composable
fun SettingsRoute(
    viewModel: ServerSettingsViewModel = hiltViewModel(),
    onSaved: () -> Unit = {},
) {
    val serverUrl by viewModel.serverUrl.collectAsStateWithLifecycle()
    val testing by viewModel.testing.collectAsStateWithLifecycle()
    val testResult by viewModel.testResult.collectAsStateWithLifecycle()
    val lastGoodUrl by viewModel.lastGoodUrl.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var showConfirmDialog by rememberSaveable { mutableStateOf(false) }

    ServerSettingsScreen(
        serverUrl = serverUrl,
        testing = testing,
        testResult = testResult,
        lastGoodUrl = lastGoodUrl,
        onUrlChange = viewModel::onUrlChange,
        onTestConnection = { scope.launch { viewModel.testConnection() } },
        onSaveClicked = { showConfirmDialog = true },
        onRevert = viewModel::revert,
        onResetToDefault = { scope.launch { viewModel.resetToDefault() } },
    )

    if (showConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showConfirmDialog = false },
            title = { Text("Switch server?") },
            text = { Text("Switching servers will sign you out and clear cached data. Continue?") },
            confirmButton = {
                TextButton(
                    onClick = {
                        showConfirmDialog = false
                        scope.launch { viewModel.save(onSaved) }
                    },
                ) {
                    Text("Continue")
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmDialog = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ServerSettingsScreen(
    serverUrl: String,
    testing: Boolean,
    testResult: ServerTestResult,
    lastGoodUrl: String,
    onUrlChange: (String) -> Unit,
    onTestConnection: () -> Unit,
    onSaveClicked: () -> Unit,
    onRevert: () -> Unit,
    onResetToDefault: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Settings") })
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 24.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Server",
                style = MaterialTheme.typography.titleMedium,
            )
            OutlinedTextField(
                value = serverUrl,
                onValueChange = onUrlChange,
                label = { Text("Server URL") },
                placeholder = { Text("https://your-server/autoupdate/v2") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = onTestConnection,
                enabled = serverUrl.isNotBlank() && !testing,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (testing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Test connection")
                }
            }
            when (testResult) {
                is ServerTestResult.Success -> StatusBanner(
                    message = "Connected in ${testResult.latencyMs} ms",
                    isError = false,
                )
                is ServerTestResult.Failure -> StatusBanner(
                    message = testResult.message,
                    isError = true,
                )
                else -> Unit
            }
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = onSaveClicked,
                enabled = serverUrl.isNotBlank() && !testing && serverUrl != lastGoodUrl,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Save")
            }
            OutlinedButton(
                onClick = onRevert,
                enabled = lastGoodUrl.isNotBlank() && serverUrl != lastGoodUrl,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Revert to last good")
            }
            TextButton(
                onClick = onResetToDefault,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Reset to default")
            }
        }
    }
}
