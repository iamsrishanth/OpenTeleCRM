package com.opentelecrm.core.network.api

import com.opentelecrm.core.model.HealthResponse
import com.opentelecrm.core.model.MetadataResponse
import com.opentelecrm.core.model.TokenExchangeResponse
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * OpenTeleCRM REST API.
 *
 * The Retrofit baseUrl is a placeholder (`http://10.0.2.2:3005/`);
 * [com.opentelecrm.core.network.ServerUrlInterceptor] rewrites the host/scheme
 * per request to the configured server (see [com.opentelecrm.core.network.ServerUrlStore]).
 */
interface OpenTeleCrmApi {

    @GET("health")
    suspend fun health(): HealthResponse

    @POST("enterprise/{eid}/auth/exchange")
    suspend fun exchange(
        @Path("eid") eid: String,
        @Body body: ExchangeRequest,
    ): TokenExchangeResponse

    @GET("enterprise/{eid}/metadata")
    suspend fun metadata(@Path("eid") eid: String): MetadataResponse
}

@Serializable
data class ExchangeRequest(
    val secret: String,
)
