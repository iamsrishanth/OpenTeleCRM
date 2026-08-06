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
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner

/**
 * Login with an enterprise ID plus either a server secret or a developer JWT.
 *
 * @param onLoggedIn invoked after a successful login; the host navigates to home.
 */
@Composable
fun LoginRoute(
    viewModel: LoginViewModel = hiltViewModel(),
    onLoggedIn: () -> Unit = {},
) {
    val loginState by viewModel.loginState.collectAsStateWithLifecycle()

    LaunchedEffect(loginState) {
        if (loginState is LoginState.Success) onLoggedIn()
    }

    var enterpriseId by rememberSaveable { mutableStateOf("") }
    var secretOrToken by rememberSaveable { mutableStateOf("") }
    var showSecret by rememberSaveable { mutableStateOf(false) }

    LoginScreen(
        enterpriseId = enterpriseId,
        secretOrToken = secretOrToken,
        showSecret = showSecret,
        loginState = loginState,
        onEnterpriseIdChange = { enterpriseId = it },
        onSecretOrTokenChange = { secretOrToken = it },
        onToggleSecret = { showSecret = !showSecret },
        onLogin = { viewModel.login(enterpriseId, secretOrToken) },
    )
}

@Composable
private fun LoginScreen(
    enterpriseId: String,
    secretOrToken: String,
    showSecret: Boolean,
    loginState: LoginState,
    onEnterpriseIdChange: (String) -> Unit,
    onSecretOrTokenChange: (String) -> Unit,
    onToggleSecret: () -> Unit,
    onLogin: () -> Unit,
) {
    val loading = loginState is LoginState.Loading
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
                text = "Sign in",
                style = MaterialTheme.typography.headlineMedium,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "Use your enterprise secret or a developer token",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(32.dp))
            OutlinedTextField(
                value = enterpriseId,
                onValueChange = onEnterpriseIdChange,
                label = { Text("Enterprise ID") },
                singleLine = true,
                enabled = !loading,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(16.dp))
            OutlinedTextField(
                value = secretOrToken,
                onValueChange = onSecretOrTokenChange,
                label = { Text("Secret / Token") },
                singleLine = true,
                enabled = !loading,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                visualTransformation = if (showSecret) VisualTransformation.None else PasswordVisualTransformation(),
                trailingIcon = {
                    TextButton(onClick = onToggleSecret, enabled = !loading) {
                        Text(if (showSecret) "Hide" else "Show")
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )
            if (loginState is LoginState.Error) {
                Spacer(Modifier.height(16.dp))
                StatusBanner(message = loginState.message, isError = true)
            }
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onLogin,
                enabled = enterpriseId.isNotBlank() && secretOrToken.isNotBlank() && !loading,
                modifier = Modifier.fillMaxWidth(),
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp,
                    )
                } else {
                    Text("Login")
                }
            }
        }
    }
}
