package com.opentelecrm.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.opentelecrm.core.model.LeadSummary
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** Room cache row for a lead (mirrors the live API LeadSummary, verified Aug 2026). */
@Entity(tableName = "lead_cache")
data class LeadEntity(
    @PrimaryKey val id: String,
    val identifier: String? = null,
    val customFieldsJson: String = "{}",
    val source: String? = null,
    val score: Int? = null,
    val tagsJson: String = "[]",
    val stageId: String? = null,
    val pipelineId: String? = null,
    val ownerUserId: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
)

fun LeadEntity.toSummary(): LeadSummary = LeadSummary(
    id = id,
    identifier = identifier,
    customFields = Json.parseToJsonElement(customFieldsJson).jsonObject,
    source = source,
    score = score,
    tags = runCatching { Json.decodeFromString<List<String>>(tagsJson) }.getOrDefault(emptyList()),
    stageId = stageId,
    pipelineId = pipelineId,
    ownerUserId = ownerUserId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)

fun LeadSummary.toEntity(): LeadEntity = LeadEntity(
    id = id,
    identifier = identifier,
    customFieldsJson = customFields.toString(),
    source = source,
    score = score,
    tagsJson = Json.encodeToString(tags),
    stageId = stageId,
    pipelineId = pipelineId,
    ownerUserId = ownerUserId,
    createdAt = createdAt,
    updatedAt = updatedAt,
)
