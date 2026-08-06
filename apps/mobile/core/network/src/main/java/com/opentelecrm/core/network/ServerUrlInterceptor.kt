package com.opentelecrm.core.network

import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Rewrites every request's scheme/host/port onto the configured API server.
 *
 * The Retrofit baseUrl is only a placeholder; this interceptor replaces it
 * per request using [baseUrl].
 *
 * Startup wiring: [baseUrl] is a @Volatile var intentionally left empty.
 * The app sets it once at startup (Application.onCreate or MainActivity)
 * from [ServerUrlStore.current], e.g.:
 *
 * ```
 * lifecycleScope.launch {
 *     serverUrlInterceptor.baseUrl = serverUrlStore.current()
 * }
 * ```
 *
 * Because the interceptor is a @Singleton injected into the shared OkHttpClient,
 * mutating [baseUrl] on the injected instance affects all requests immediately.
 */
@Singleton
class ServerUrlInterceptor @Inject constructor() : Interceptor {

    @Volatile
    var baseUrl: String = ""

    override fun intercept(chain: Interceptor.Chain): Response {
        if (baseUrl.isBlank()) {
            throw IOException("API server URL not configured")
        }
        val rewritten = apply(chain.request().url)
        val request = chain.request().newBuilder()
            .url(rewritten)
            .build()
        return chain.proceed(request)
    }

    /**
     * Rewrites [url] onto [baseUrl], preserving the request path (appended
     * after the base path, e.g. the "/autoupdate/v2" prefix) and query.
     * Internal so unit tests can exercise it without a full OkHttp chain.
     */
    internal fun apply(url: HttpUrl): HttpUrl {
        val base = baseUrl.toHttpUrl()
        val builder = base.newBuilder()
        for (segment in url.pathSegments) {
            builder.addPathSegment(segment)
        }
        url.encodedQuery?.let { builder.encodedQuery(it) }
        return builder.build()
    }
}
