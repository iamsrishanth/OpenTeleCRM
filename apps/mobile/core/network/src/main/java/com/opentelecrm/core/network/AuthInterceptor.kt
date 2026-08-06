package com.opentelecrm.core.network

import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import okhttp3.Interceptor
import okhttp3.Response

/**
 * Adds the Authorization Bearer header when a token is available.
 *
 * Never authenticates public endpoints:
 * - anything whose path contains "/auth/exchange" (token exchange is done
 *   with the enterprise secret, before any session token exists);
 * - the "/health" endpoint.
 *
 * TokenProvider is injected as a lazy [Provider] to break the Hilt cycle
 * OkHttpClient → AuthInterceptor → TokenProvider(SessionManager) → api →
 * Retrofit → OkHttpClient. The token is read at request time anyway.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenProvider: Provider<TokenProvider>,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val path = request.url.encodedPath
        val isPublic = path.contains("/auth/exchange") || path.endsWith("/health")
        val token = tokenProvider.get().token()

        if (token != null && !isPublic) {
            val authenticated = request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
            return chain.proceed(authenticated)
        }
        return chain.proceed(request)
    }
}
