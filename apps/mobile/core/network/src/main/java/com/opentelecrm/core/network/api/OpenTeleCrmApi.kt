package com.opentelecrm.core.network.api

import com.opentelecrm.core.model.ActionSearchRequest
import com.opentelecrm.core.model.ActionSearchResponse
import com.opentelecrm.core.model.CallListResponse
import com.opentelecrm.core.model.CallRecord
import com.opentelecrm.core.model.CallbackCreateRequest
import com.opentelecrm.core.model.CallbackItem
import com.opentelecrm.core.model.CallbackListResponse
import com.opentelecrm.core.model.CallerIdResponse
import com.opentelecrm.core.model.CreateActionsRequest
import com.opentelecrm.core.model.CreateActionsResponse
import com.opentelecrm.core.model.CustomActionsResponse
import com.opentelecrm.core.model.DialRequest
import com.opentelecrm.core.model.DialResponse
import com.opentelecrm.core.model.DialerNextResponse
import com.opentelecrm.core.model.DispositionRequest
import com.opentelecrm.core.model.DispositionResponse
import com.opentelecrm.core.model.HealthResponse
import com.opentelecrm.core.model.LeadSearchRequest
import com.opentelecrm.core.model.LeadSearchResponse
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.MetadataResponse
import com.opentelecrm.core.model.TeamMembersResponse
import com.opentelecrm.core.model.TokenExchangeResponse
import com.opentelecrm.core.model.SendWhatsAppRequest
import com.opentelecrm.core.model.SendWhatsAppResponse
import com.opentelecrm.core.model.WhatsAppConversationResponse
import com.opentelecrm.core.model.WhatsAppMessageResponse
import com.opentelecrm.core.model.WhatsAppTemplatesResponse
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
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

    // --- Telephony / Dialer (M3) ---

    /** POST /enterprise/{eid}/dialer/next — next dialer candidate. */
    @POST("enterprise/{eid}/dialer/next")
    suspend fun dialerNext(@Path("eid") eid: String, @Body body: DialRequest = DialRequest()): DialerNextResponse

    /** POST /enterprise/{eid}/dialer/{leadId}/dial — place a call (API → Asterisk ARI / mock). */
    @POST("enterprise/{eid}/dialer/{leadId}/dial")
    suspend fun dial(
        @Path("eid") eid: String,
        @Path("leadId") leadId: String,
        @Body body: DialRequest,
    ): DialResponse

    /** POST /enterprise/{eid}/dialer/{leadId}/disposition — save call outcome. */
    @POST("enterprise/{eid}/dialer/{leadId}/disposition")
    suspend fun disposition(
        @Path("eid") eid: String,
        @Path("leadId") leadId: String,
        @Body body: DispositionRequest,
    ): DispositionResponse

    /** POST /enterprise/{eid}/dialer/{leadId}/skip — skip candidate. */
    @POST("enterprise/{eid}/dialer/{leadId}/skip")
    suspend fun skip(@Path("eid") eid: String, @Path("leadId") leadId: String, @Body body: JsonObject = JsonObject(emptyMap())): DispositionResponse

    /** GET /enterprise/{eid}/calls — call history / live call state (poll). */
    @GET("enterprise/{eid}/calls")
    suspend fun callsList(@Path("eid") eid: String): CallListResponse

    /** GET /enterprise/{eid}/calls/{id} — single call row. */
    @GET("enterprise/{eid}/calls/{id}")
    suspend fun callsGet(@Path("eid") eid: String, @Path("id") id: String): CallRecord

    /** POST /enterprise/{eid}/callbacks — schedule follow-up. */
    @POST("enterprise/{eid}/callbacks")
    suspend fun callbacksCreate(@Path("eid") eid: String, @Body body: CallbackCreateRequest): CallbackItem

    /** GET /enterprise/{eid}/callbacks — follow-ups list. */
    @GET("enterprise/{eid}/callbacks")
    suspend fun callbacksList(@Path("eid") eid: String): CallbackListResponse

    /** GET /enterprise/{eid}/caller-id/{phone} — incoming-call lead lookup. */
    @GET("enterprise/{eid}/caller-id/{phone}")
    suspend fun callerId(@Path("eid") eid: String, @Path("phone") phone: String): CallerIdResponse

    // --- WhatsApp / Inbox (M4) ---

    /** GET /enterprise/{eid}/whatsapp/conversations — inbox list. */
    @GET("enterprise/{eid}/whatsapp/conversations")
    suspend fun whatsappConversations(@Path("eid") eid: String): WhatsAppConversationResponse

    /** GET /enterprise/{eid}/whatsapp/conversations/{id}/messages — thread. */
    @GET("enterprise/{eid}/whatsapp/conversations/{conversationId}/messages")
    suspend fun whatsappMessages(
        @Path("eid") eid: String,
        @Path("conversationId") conversationId: String,
    ): WhatsAppMessageResponse

    /** POST /enterprise/{eid}/whatsapp/send — outbound text (mock/bridge driver). */
    @POST("enterprise/{eid}/whatsapp/send")
    suspend fun whatsappSend(
        @Path("eid") eid: String,
        @Body body: SendWhatsAppRequest,
    ): SendWhatsAppResponse

    /** GET /enterprise/{eid}/whatsapp/templates — approved templates. */
    @GET("enterprise/{eid}/whatsapp/templates")
    suspend fun whatsappTemplates(@Path("eid") eid: String): WhatsAppTemplatesResponse
}

@Serializable
data class ExchangeRequest(
    val secret: String,
)
