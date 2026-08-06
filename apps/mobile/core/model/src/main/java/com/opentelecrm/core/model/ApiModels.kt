package com.opentelecrm.core.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Generic envelope used by most OpenTeleCRM endpoints:
 * `{ "data": ..., "error": { "code": ..., "message": ... } }`.
 *
 * Unknown JSON keys are ignored by the `Json { ignoreUnknownKeys = true }`
 * instance configured in :core:network.
 */
@Serializable
data class ApiEnvelope<T>(
    val data: T? = null,
    val error: ApiError? = null,
)

@Serializable
data class ApiError(
    val code: String,
    val message: String? = null,
)

@Serializable
data class HealthResponse(
    val status: String? = null,
    val service: String? = null,
    val time: String? = null,
)

@Serializable
data class EnterpriseInfo(
    val id: String,
    val name: String,
    val leadIdentifier: String? = null,
    val timezone: String? = null,
    val locale: String? = null,
)

@Serializable
data class PipelineInfo(
    val id: String,
    val name: String,
    val stages: List<StageInfo> = emptyList(),
)

@Serializable
data class StageInfo(
    val id: String,
    val name: String,
)

@Serializable
data class MetadataResponse(
    val enterprise: EnterpriseInfo? = null,
    val pipelines: List<PipelineInfo> = emptyList(),
    val actionTypes: List<JsonElement> = emptyList(),
)

@Serializable
data class TokenExchangeData(
    val rawToken: String,
    val tail: String,
    val name: String,
    val type: String,
    val expiresAt: String,
)

@Serializable
data class TokenExchangeResponse(
    val data: TokenExchangeData? = null,
    val error: ApiError? = null,
)

/** Lead projection matching the live API (verified Aug 2026 via lead/search + lead/{id}). */
@Serializable
data class LeadSummary(
    val id: String,
    val identifier: String? = null,
    val customFields: JsonObject = JsonObject(emptyMap()),
    val source: String? = null,
    val score: Int? = null,
    val tags: List<String> = emptyList(),
    val stageId: String? = null,
    val pipelineId: String? = null,
    val ownerUserId: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
) {
    /** Convenience: reads a string field from customFields (e.g. "name", "city"). */
    fun customFieldString(key: String): String? =
        (customFields[key] as? JsonPrimitive)?.takeIf { it.isString }?.content
}

/** POST /lead/search body — filters are optional; skip/limit paginate. */
@Serializable
data class LeadSearchRequest(
    val skip: Int = 0,
    val limit: Int = 50,
    val filters: List<LeadFilter> = emptyList(),
)

/** API filter: {field, op: eq|contains|gt|lt|in|between|isNull|regex, value}. */
@Serializable
data class LeadFilter(
    val field: String,
    val op: String,
    val value: JsonElement = JsonNull,
)

/** POST /lead/search response — data is wrapped with a total count. */
@Serializable
data class LeadSearchResponse(
    val data: List<LeadSummary> = emptyList(),
    val total: Int = 0,
)

/** GET /team-members item — verified Aug 2026. */
@Serializable
data class TeamMember(
    val id: String,
    val email: String,
    val name: String,
    val role: TeamRole? = null,
    val availability: String? = null,
    val shift: String? = null,
    val skills: List<String> = emptyList(),
    val capacity: Int? = null,
)

@Serializable
data class TeamRole(
    val name: String? = null,
    val kind: String? = null,
)

@Serializable
data class TeamMembersResponse(
    val data: List<TeamMember> = emptyList(),
)

// --- Actions (M2) — verified Aug 2026 via live API ---

/** GET/POST action/search item shape. */
@Serializable
data class ActionSummary(
    val id: String,
    val actionId: String? = null,
    val leadId: String? = null,
    val actionTypeId: String? = null,
    val userId: String? = null,
    val payload: JsonObject = JsonObject(emptyMap()),
    val note: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class ActionSearchRequest(
    val skip: Int = 0,
    val limit: Int = 50,
    val filters: List<LeadFilter> = emptyList(),
)

@Serializable
data class ActionSearchResponse(
    val data: List<ActionSummary> = emptyList(),
    val total: Int = 0,
)

/** One item in POST /lead/{id}/action's batch — type is note|call|whatsapp|<customCode>. */
@Serializable
data class CreateActionItem(
    val type: String,
    val note: String? = null,
    val payload: JsonObject? = null,
)

@Serializable
data class CreateActionsRequest(
    val actions: List<CreateActionItem>,
)

@Serializable
data class ActionResultItem(
    val actionId: String = "",
    val id: String = "",
    val typeId: String = "",
    val status: String = "IGNORED",
    val remarks: List<String> = emptyList(),
)

@Serializable
data class CreateActionsResponse(
    val data: List<ActionResultItem> = emptyList(),
    val total: Int = 0,
)

/** GET /custom-actions item. */
@Serializable
data class CustomAction(
    val code: String,
    val name: String,
    val isSystem: Boolean = false,
    val fieldSchema: JsonObject = JsonObject(emptyMap()),
)

@Serializable
data class CustomActionsResponse(
    val data: List<CustomAction> = emptyList(),
)

// --- Telephony / Dialer (M3) — verified Aug 2026 via live API ---

/** POST /dialer/next candidate. */
@Serializable
data class DialerCandidate(
    val leadId: String,
    val identifier: String? = null,
    val phone: String? = null,
    val score: Int? = null,
    val reasons: List<String> = emptyList(),
    val followUpDueAt: String? = null,
    val slaBreachRisk: Int? = null,
    val leadScore: Int? = null,
    val freshnessHours: Double? = null,
    val lastDialedAt: String? = null,
)

@Serializable
data class DialerNextResponse(
    val data: List<DialerCandidate> = emptyList(),
)

/** POST /dialer/{leadId}/dial response — callId is the provider's id, id the call row. */
@Serializable
data class DialResponse(
    val callId: String? = null,
    val id: String? = null,
)

@Serializable
data class DialRequest(
    val from: String? = null,
)

/** Valid disposition values (server-enforced; verified Aug 2026). */
object Dispositions {
    const val ANSWERED = "answered"
    const val NO_ANSWER = "no_answer"
    const val BUSY = "busy"
    const val NOT_CONNECTED = "not_connected"
    const val WRONG_NUMBER = "wrong_number"
    const val NOT_INTERESTED = "not_interested"
    const val CALLBACK = "callback"
    const val DNC = "dnc"
    const val CONVERTED = "converted"
    const val FOLLOW_UP = "follow_up"
    const val OTHER = "other"

    val ALL: List<String> = listOf(
        ANSWERED, NO_ANSWER, BUSY, NOT_CONNECTED, WRONG_NUMBER, NOT_INTERESTED,
        CALLBACK, DNC, CONVERTED, FOLLOW_UP, OTHER,
    )
}

@Serializable
data class DispositionRequest(
    val disposition: String,
    val note: String? = null,
)

@Serializable
data class DispositionResponse(
    val data: JsonObject? = null,
    val error: ApiError? = null,
)

/** GET /calls item. */
@Serializable
data class CallRecord(
    val id: String,
    val leadId: String? = null,
    val direction: String? = null,
    val status: String? = null,
    val disposition: String? = null,
    val phone: String? = null,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val durationSec: Int? = null,
    val talkSec: Int? = null,
    val ringSec: Int? = null,
    val recordingId: String? = null,
    val trunk: String? = null,
    val did: String? = null,
    val agentUserId: String? = null,
    val note: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

@Serializable
data class CallListResponse(
    val data: List<CallRecord> = emptyList(),
    val total: Int = 0,
)

/** POST /callbacks body + response item. */
@Serializable
data class CallbackCreateRequest(
    val leadId: String,
    val quickChip: String? = null,
    val note: String? = null,
    val dueAt: String? = null,
)

@Serializable
data class CallbackItem(
    val id: String? = null,
    val leadId: String? = null,
    val dueAt: String? = null,
    val status: String? = null,
    val note: String? = null,
)

@Serializable
data class CallbackListResponse(
    val data: List<CallbackItem> = emptyList(),
    val total: Int = 0,
)

/** GET /caller-id/{phone} — found + full lead with lastCalls/lastActions. */
@Serializable
data class CallerIdResponse(
    val found: Boolean = false,
    val lead: CallerIdLead? = null,
)

@Serializable
data class CallerIdLead(
    val id: String? = null,
    val identifier: String? = null,
    val score: Int? = null,
    val stageId: String? = null,
    val pipelineId: String? = null,
    val ownerUserId: String? = null,
    val source: String? = null,
    val tags: List<String> = emptyList(),
    val customFields: JsonObject = JsonObject(emptyMap()),
    val lastCalls: List<JsonElement> = emptyList(),
    val lastActions: List<JsonElement> = emptyList(),
) {
    fun name(): String? = (customFields["name"] as? JsonPrimitive)?.takeIf { it.isString }?.content
}
