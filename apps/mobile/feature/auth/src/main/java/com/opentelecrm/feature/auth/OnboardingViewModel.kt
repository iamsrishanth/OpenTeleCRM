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
        val url = _serverUrl.value.trim()
        if (!isValidUrl(url)) {
            _testResult.value = ServerTestResult.Failure("Enter a valid server URL (https://your-server/autoupdate/v2)")
            return
        }
        _testing.value = true
        _testResult.value = ServerTestResult.Testing
        val start = System.currentTimeMillis()
        try {
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

    private fun isValidUrl(url: String): Boolean {
        if (!url.startsWith("https://") && !url.startsWith("http://")) return false
        val host = url
            .removePrefix("https://")
            .removePrefix("http://")
            .substringBefore('/')
        return host.isNotBlank() && host.contains('.')
    }
}
