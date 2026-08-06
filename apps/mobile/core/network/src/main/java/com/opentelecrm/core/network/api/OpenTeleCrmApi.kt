package com.opentelecrm.core.network.api

import com.opentelecrm.core.model.ActionSearchRequest
import com.opentelecrm.core.model.ActionSearchResponse
import com.opentelecrm.core.model.CreateActionsRequest
import com.opentelecrm.core.model.CreateActionsResponse
import com.opentelecrm.core.model.CustomActionsResponse
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

    /** POST /enterprise/{eid}/lead/{leadId}/action — batch, per-item statuses (M2). */
    @POST("enterprise/{eid}/lead/{leadId}/action")
    suspend fun createActions(
        @Path("eid") eid: String,
        @Path("leadId") leadId: String,
        @Body body: CreateActionsRequest,
    ): CreateActionsResponse

    /** POST /enterprise/{eid}/lead/{leadId}/action/search — timeline (M2). */
    @POST("enterprise/{eid}/lead/{leadId}/action/search")
    suspend fun searchActions(
        @Path("eid") eid: String,
        @Path("leadId") leadId: String,
        @Body body: ActionSearchRequest,
    ): ActionSearchResponse

    /** GET /enterprise/{eid}/custom-actions (M2). */
    @GET("enterprise/{eid}/custom-actions")
    suspend fun customActions(@Path("eid") eid: String): CustomActionsResponse
}

@Serializable
data class ExchangeRequest(
    val secret: String,
)
