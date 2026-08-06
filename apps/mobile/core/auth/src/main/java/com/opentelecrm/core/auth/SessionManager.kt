package com.opentelecrm.core.auth

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.opentelecrm.core.auth.security.CryptoManager
import com.opentelecrm.core.network.ServerUrlStore
import com.opentelecrm.core.network.TokenProvider
import com.opentelecrm.core.network.api.ExchangeRequest
import com.opentelecrm.core.network.api.OpenTeleCrmApi
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import retrofit2.HttpException

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

/**
 * Owns the authenticated session: in-memory [Session] plus an encrypted, persisted
 * copy (DataStore + [CryptoManager]) used to restore the session after process death.
 *
 * Auth failures are surfaced as exceptions with readable messages; an invalid secret
 * propagates the server's own response text.
 */
@Singleton
class SessionManager @Inject constructor(
    @ApplicationContext private val context: Context,
    private val api: OpenTeleCrmApi,
    private val serverUrlStore: ServerUrlStore,
    private val cryptoManager: CryptoManager,
) : TokenProvider {

    private val _session = MutableStateFlow<Session?>(null)

    /** Current in-memory session; null when logged out. */
    val session: StateFlow<Session?> = _session.asStateFlow()

    override fun token(): String? = _session.value?.token

    /** Restores a previously persisted (encrypted) session, if any. */
    suspend fun restore() {
        val prefs = context.sessionDataStore.data.first()
        val enterpriseId = prefs[KEY_ENTERPRISE_ID] ?: return
        val tokenType = prefs[KEY_TOKEN_TYPE] ?: Session.TOKEN_TYPE_SYNC
        val encryptedToken = prefs[KEY_ENCRYPTED_TOKEN]
        if (encryptedToken == null) {
            _session.value = Session(enterpriseId, tokenType)
            return
        }
        val token = try {
            cryptoManager.decrypt(encryptedToken)
        } catch (e: Exception) {
            // Key invalidated or data corrupt — drop the persisted copy and stay logged out.
            context.sessionDataStore.edit { it.clear() }
            return
        }
        _session.value = Session(enterpriseId, tokenType, token)
    }

    /** Exchanges an enterprise secret for a server-issued sync token and persists it. */
    suspend fun loginWithSecret(enterpriseId: String, secret: String) {
        val token = try {
            val rawToken = api.exchange(enterpriseId, ExchangeRequest(secret)).data?.rawToken
            rawToken ?: throw IllegalStateException("Server did not return a token")
        } catch (e: HttpException) {
            val serverMessage = e.response()?.errorBody()?.string()?.trim()?.takeIf { it.isNotBlank() }
            throw IllegalStateException(serverMessage ?: "Login failed: server returned HTTP ${e.code()}")
        } catch (e: Exception) {
            throw IllegalStateException("Could not reach server: ${e.message ?: "unknown error"}")
        }
        setSession(Session(enterpriseId, Session.TOKEN_TYPE_SYNC, token))
    }

    /** Stores a developer JWT directly (bypasses secret exchange). */
    suspend fun loginWithJwt(enterpriseId: String, jwt: String) {
        setSession(Session(enterpriseId, Session.TOKEN_TYPE_DEV_JWT, jwt))
    }

    /** Clears the in-memory session and the persisted copy. */
    fun logout() {
        _session.value = null
        // Fire-and-forget: DataStore edit must run on a coroutine; UI calls logout()
        // from any thread, so scope it to the application's IO dispatcher.
        kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch {
            context.sessionDataStore.edit { it.clear() }
        }
    }

    /**
     * Called when the server URL changes: signs out and clears locally persisted
     * session/cache markers so nothing leaks across servers. (Room sync cursors are
     * cleared by the data layer on the next sync after a URL change.)
     */
    suspend fun clearForServerChange() {
        _session.value = null
        context.sessionDataStore.edit { it.clear() }
    }

    private suspend fun setSession(session: Session) {
        _session.value = session
        context.sessionDataStore.edit { prefs ->
            prefs[KEY_ENTERPRISE_ID] = session.enterpriseId
            prefs[KEY_TOKEN_TYPE] = session.tokenType
            session.token?.let { prefs[KEY_ENCRYPTED_TOKEN] = cryptoManager.encrypt(it) }
        }
    }

    private companion object {
        val KEY_ENTERPRISE_ID = stringPreferencesKey("enterprise_id")
        val KEY_TOKEN_TYPE = stringPreferencesKey("token_type")
        val KEY_ENCRYPTED_TOKEN = stringPreferencesKey("encrypted_token")
    }
}
