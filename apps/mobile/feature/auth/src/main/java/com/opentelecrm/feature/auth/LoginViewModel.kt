package com.opentelecrm.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.auth.SessionManager
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** Login screen state. */
sealed interface LoginState {
    data object Idle : LoginState
    data object Loading : LoginState
    data object Success : LoginState
    data class Error(val message: String) : LoginState
}

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val sessionManager: SessionManager,
) : ViewModel() {

    private val _loginState = MutableStateFlow<LoginState>(LoginState.Idle)
    val loginState: StateFlow<LoginState> = _loginState.asStateFlow()

    /**
     * Logs in with the given enterprise ID and either a server secret or a
     * developer JWT (detected by the JWT's two dots).
     */
    fun login(enterpriseId: String, secretOrToken: String) {
        if (enterpriseId.isBlank() || secretOrToken.isBlank()) {
            _loginState.value = LoginState.Error("Enter your enterprise ID and secret/token")
            return
        }
        _loginState.value = LoginState.Loading
        viewModelScope.launch {
            try {
                val eid = enterpriseId.trim()
                val credential = secretOrToken.trim()
                if (credential.count { it == '.' } == 2) {
                    sessionManager.loginWithJwt(eid, credential)
                } else {
                    sessionManager.loginWithSecret(eid, credential)
                }
                _loginState.value = LoginState.Success
            } catch (e: Exception) {
                _loginState.value = LoginState.Error(e.message ?: "Login failed")
            }
        }
    }
}
