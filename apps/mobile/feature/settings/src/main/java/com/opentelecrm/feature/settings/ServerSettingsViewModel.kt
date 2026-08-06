package com.opentelecrm.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.auth.SessionManager
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

/** Result of a server connectivity check (same shape as onboarding's). */
sealed interface ServerTestResult {
    data object Idle : ServerTestResult
    data object Testing : ServerTestResult
    data class Success(val latencyMs: Long) : ServerTestResult
    data class Failure(val message: String) : ServerTestResult
}

@HiltViewModel
class ServerSettingsViewModel @Inject constructor(
    private val serverUrlStore: ServerUrlStore,
    private val api: OpenTeleCrmApi,
    private val sessionManager: SessionManager,
) : ViewModel() {

    private val _serverUrl = MutableStateFlow("")
    val serverUrl: StateFlow<String> = _serverUrl.asStateFlow()

    private val _testing = MutableStateFlow(false)
    val testing: StateFlow<Boolean> = _testing.asStateFlow()

    private val _testResult = MutableStateFlow<ServerTestResult>(ServerTestResult.Idle)
    val testResult: StateFlow<ServerTestResult> = _testResult.asStateFlow()

    private val _lastGoodUrl = MutableStateFlow("")

    /** Last URL that passed a connectivity test; used by Revert. */
    val lastGoodUrl: StateFlow<String> = _lastGoodUrl.asStateFlow()

    init {
        viewModelScope.launch {
            serverUrlStore.serverUrl.first().let {
                _serverUrl.value = it
                _lastGoodUrl.value = it
            }
        }
    }

    fun onUrlChange(value: String) {
        _serverUrl.value = value
        _testResult.value = ServerTestResult.Idle
    }

    /** Validates the URL and probes the server health endpoint; on success records lastGoodUrl. */
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
            // Persist first so the ServerUrlInterceptor targets the tested URL.
            serverUrlStore.set(normalized)
            api.health()
            _testResult.value = ServerTestResult.Success(System.currentTimeMillis() - start)
            _lastGoodUrl.value = normalized
        } catch (e: HttpException) {
            _testResult.value = ServerTestResult.Failure("Server responded with HTTP ${e.code()}")
        } catch (e: Exception) {
            _testResult.value = ServerTestResult.Failure(e.message ?: "Could not reach server")
        } finally {
            _testing.value = false
        }
    }

    /**
     * Persists the new URL, signs the user out and clears cached data
     * (switching servers invalidates everything local), then invokes [onSaved].
     */
    suspend fun save(onSaved: () -> Unit) {
        val url = _serverUrl.value.trim()
        if (url.isBlank()) return
        serverUrlStore.set(url)
        sessionManager.clearForServerChange()
        onSaved()
    }

    /** Restores the field to the last successfully tested URL. */
    fun revert() {
        val lastGood = _lastGoodUrl.value
        if (lastGood.isNotBlank()) {
            _serverUrl.value = lastGood
            _testResult.value = ServerTestResult.Idle
        }
    }

    /** Clears the stored server URL, returning the field to its empty default. */
    fun resetToDefault() {
        viewModelScope.launch {
            serverUrlStore.clear()
            _serverUrl.value = ""
            _lastGoodUrl.value = ""
            _testResult.value = ServerTestResult.Idle
        }
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
