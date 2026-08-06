package com.opentelecrm.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.network.ServerUrlStore
import com.opentelecrm.core.network.api.OpenTeleCrmApi
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException

/** Result of a server connectivity check. Shared by onboarding and settings. */
sealed interface ServerTestResult {
    data object Idle : ServerTestResult
    data object Testing : ServerTestResult
    data class Success(val latencyMs: Long) : ServerTestResult
    data class Failure(val message: String) : ServerTestResult
}

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val serverUrlStore: ServerUrlStore,
    private val api: OpenTeleCrmApi,
) : ViewModel() {

    private val _serverUrl = MutableStateFlow("")

    /** Editable server URL, seeded from the store. Persisted only on save. */
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private val _testing = MutableStateFlow(false)
    val testing: StateFlow<Boolean> = _testing.asStateFlow()

    private val _testResult = MutableStateFlow<ServerTestResult>(ServerTestResult.Idle)
    val testResult: StateFlow<ServerTestResult> = _testResult.asStateFlow()

    init {
        viewModelScope.launch {
            _serverUrl.value = serverUrlStore.serverUrl.first()
        }
    }

    fun onUrlChange(value: String) {
        _serverUrl.value = value
        _testResult.value = ServerTestResult.Idle
    }

    /** Validates the URL and probes the server health endpoint, measuring latency. */
    suspend fun testConnection() {
        val raw = _serverUrl.value.trim()
        val normalized = try {
            ServerUrlStore.normalize(raw)
        } catch (e: IllegalArgumentException) {
            _testResult.value = ServerTestResult.Failure(e.message ?: "Enter a valid server URL")
            return
        }
        _serverUrl.value = normalized
        _testing.value = true
        _testResult.value = ServerTestResult.Testing
        val start = System.currentTimeMillis()
        try {
            // Persist the typed URL first so the ServerUrlInterceptor targets it.
            // (Test = save for M0: Continue then just navigates; Settings keeps
            // revert-to-last-good for correcting a bad URL.)
            serverUrlStore.set(normalized)
            api.health()
            _testResult.value = ServerTestResult.Success(System.currentTimeMillis() - start)
        } catch (e: HttpException) {
            _testResult.value = ServerTestResult.Failure("Server responded with HTTP ${e.code()}")
        } catch (e: Exception) {
            _testResult.value = ServerTestResult.Failure(e.message ?: "Could not reach server")
        } finally {
            _testing.value = false
        }
    }

    /** Persists the URL, then invokes [onSaved] so the host can navigate to login. */
    suspend fun saveAndContinue(onSaved: () -> Unit) {
        serverUrlStore.set(_serverUrl.value.trim())
        onSaved()
    }
}
