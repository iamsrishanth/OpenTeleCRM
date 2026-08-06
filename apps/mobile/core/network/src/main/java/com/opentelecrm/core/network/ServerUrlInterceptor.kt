package com.opentelecrm.core.network

import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Rewrites every request's scheme/host/port onto the configured API server.
 *
 * The Retrofit baseUrl is only a placeholder; this interceptor replaces it
 * per request using the persisted [ServerUrlStore] value (cached in [baseUrl]).
 *
 * Reads the store synchronously on each request (DataStore read, ~ms) so the
 * interceptor always targets the CURRENT configured URL — no startup wiring
 * needed and no race after the user changes it in Settings. [baseUrl] is a
 * @Volatile cache refreshed on every call.
 */
@Singleton
class ServerUrlInterceptor @Inject constructor(
    private val serverUrlStore: ServerUrlStore,
) : Interceptor {

    @Volatile
    var baseUrl: String = ""

    override fun intercept(chain: Interceptor.Chain): Response {
        val target = runBlocking { serverUrlStore.current() }
        baseUrl = target
        if (target.isBlank()) {
            throw IOException("API server URL not configured")
        }
        val rewritten = apply(chain.request().url, target)
        val request = chain.request().newBuilder()
            .url(rewritten)
            .build()
        return chain.proceed(request)
    }

    /**
     * Rewrites [url] onto [base], preserving the request path (appended
     * after the base path, e.g. the "/autoupdate/v2" prefix) and query.
     * Internal so unit tests can exercise it without a full OkHttp chain.
     *
     * API routing note: OpenTeleCRM serves `GET /health` at the ROOT (it is
     * excluded from the global `/autoupdate/v2` prefix), so a request whose
     * placeholder path is exactly `/health` is rewritten onto the base with
     * the `/autoupdate/v2` suffix stripped.
     */
    internal fun apply(url: HttpUrl, base: String = baseUrl): HttpUrl {
        val baseToUse = if (url.encodedPath == "/health") {
            base.removeSuffix("/autoupdate/v2")
        } else {
            base
        }
        val builder = baseToUse.toHttpUrl().newBuilder()
        for (segment in url.pathSegments) {
            builder.addPathSegment(segment)
        }
        url.encodedQuery?.let { builder.encodedQuery(it) }
        return builder.build()
    }
}
