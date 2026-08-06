package com.opentelecrm.core.network

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.serverUrlDataStore: DataStore<Preferences> by preferencesDataStore(
    name = "server_url",
)

/**
 * Persists the configured API server base URL in DataStore.
 *
 * The stored value is normalized by [normalize]: absolute http(s) URL without
 * trailing slash, suffixed with "/autoupdate/v2". An empty string means
 * "not configured yet" — the app should route the user to connection setup.
 */
@Singleton
class ServerUrlStore @Inject constructor(
    @ApplicationContext private val context: Context,
) {

    private val apiBaseUrlKey = stringPreferencesKey("api_base_url")

    /** Emits the configured URL, or "" when unset. */
    val serverUrl: Flow<String> = context.serverUrlDataStore.data.map { prefs ->
        prefs[apiBaseUrlKey] ?: ""
    }

    suspend fun current(): String = serverUrl.first()

    /** Normalizes [url] via [normalize] and persists it. */
    suspend fun set(url: String) {
        val normalized = normalize(url)
        context.serverUrlDataStore.edit { prefs ->
            prefs[apiBaseUrlKey] = normalized
        }
    }

    suspend fun clear() {
        context.serverUrlDataStore.edit { prefs ->
            prefs.remove(apiBaseUrlKey)
        }
    }

    companion object {
        /**
         * Validation/normalization rule for a raw API base URL:
         * 1. trims whitespace;
         * 2. requires an `http://` or `https://` scheme, else throws [IllegalArgumentException];
         * 3. strips any trailing '/';
         * 4. appends "/autoupdate/v2" unless already present.
         */
        fun normalize(raw: String): String {
            val trimmed = raw.trim()
            require(trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
                "API server URL must start with http:// or https://"
            }
            require(trimmed.length > "https://".length) {
                "API server URL is too short"
            }
            var url = trimmed.trimEnd('/')
            if (!url.endsWith("/autoupdate/v2")) {
                url += "/autoupdate/v2"
            }
            return url
        }
    }
}
