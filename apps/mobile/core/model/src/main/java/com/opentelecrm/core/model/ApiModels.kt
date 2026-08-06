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
