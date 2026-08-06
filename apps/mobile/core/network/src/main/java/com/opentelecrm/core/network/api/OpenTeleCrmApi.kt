package com.opentelecrm.core.network.api

import com.opentelecrm.core.model.HealthResponse
import com.opentelecrm.core.model.LeadSearchRequest
import com.opentelecrm.core.model.LeadSearchResponse
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.MetadataResponse
import com.opentelecrm.core.model.TeamMembersResponse
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

    /** POST /enterprise/{eid}/lead/search — verified live shape {data:[...], total}. */
    @POST("enterprise/{eid}/lead/search")
    suspend fun searchLeads(
        @Path("eid") eid: String,
        @Body body: LeadSearchRequest,
    ): LeadSearchResponse

    /** GET /enterprise/{eid}/lead/{leadId} — returns the lead object directly (no data wrapper). */
    @GET("enterprise/{eid}/lead/{leadId}")
    suspend fun getLead(
        @Path("eid") eid: String,
        @Path("leadId") leadId: String,
    ): LeadSummary

    /** GET /enterprise/{eid}/team-members — verified live shape {data:[...]}. */
    @GET("enterprise/{eid}/team-members")
    suspend fun teamMembers(@Path("eid") eid: String): TeamMembersResponse
}

@Serializable
data class ExchangeRequest(
    val secret: String,
)
