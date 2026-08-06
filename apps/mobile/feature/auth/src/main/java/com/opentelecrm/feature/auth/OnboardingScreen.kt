package com.opentelecrm.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import kotlinx.coroutines.launch

/**
 * First-run onboarding: pick the server URL, verify connectivity, continue to login.
 *
 * @param onSaved invoked after the URL is persisted; the host navigates to login.
 */
@Composable
fun OnboardingRoute(
    viewModel: OnboardingViewModel = hiltViewModel(),
    onSaved: () -> Unit = {},
) {
    val serverUrl by viewModel.serverUrl.collectAsStateWithLifecycle()
    val testing by viewModel.testing.collectAsStateWithLifecycle()
    val testResult by viewModel.testResult.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    OnboardingScreen(
        serverUrl = serverUrl,
        testing = testing,
        testResult = testResult,
        onUrlChange = viewModel::onUrlChange,
        onTestConnection = { scope.launch { viewModel.testConnection() } },
        onContinue = { scope.launch { viewModel.saveAndContinue(onSaved) } },
    )
}

@Composable
private fun OnboardingScreen(
    serverUrl: String,
    testing: Boolean,
    testResult: ServerTestResult,
    onUrlChange: (String) -> Unit,
    onTestConnection: () -> Unit,
    onContinue: () -> Unit,
) {
    Scaffold { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(
                text = "OpenTeleCRM",
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Connect to your workspace",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
            OutlinedTextField(
                value = serverUrl,
                onValueChange = onUrlChange,
                label = { Text("Server URL") },
                placeholder = { Text("https://your-server/autoupdate/v2") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
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
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onContinue,
                enabled = serverUrl.isNotBlank() && !testing,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Continue")
            }
        }
    }
}
