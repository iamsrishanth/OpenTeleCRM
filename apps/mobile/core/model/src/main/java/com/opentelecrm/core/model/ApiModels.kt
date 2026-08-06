package com.opentelecrm.core.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject

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

/**
 * Minimal lead projection. M1 expands this with more fields
 * (name, stage, values, custom fields by type, etc.).
 */
@Serializable
data class LeadSummary(
    val id: String,
    val identifier: String? = null,
    val customFields: JsonObject = JsonObject(emptyMap()),
)
