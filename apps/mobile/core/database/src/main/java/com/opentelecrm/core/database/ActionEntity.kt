package com.opentelecrm.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import com.opentelecrm.core.model.ActionSummary
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

/** Cached action/timeline row for a lead (mirrors live API ActionSummary). */
@Entity(
    tableName = "action_cache",
    indices = [Index("leadId")],
)
data class ActionEntity(
    @PrimaryKey val id: String,
    val leadId: String? = null,
    val actionTypeId: String? = null,
    val userId: String? = null,
    val payloadJson: String = "{}",
    val note: String? = null,
    val createdAt: String? = null,
)

fun ActionEntity.toSummary(): ActionSummary = ActionSummary(
    id = id,
    actionId = id,
    leadId = leadId,
    actionTypeId = actionTypeId,
    userId = userId,
    payload = runCatching { Json.parseToJsonElement(payloadJson).jsonObject }.getOrDefault(JsonObject(emptyMap())),
    note = note,
    createdAt = createdAt,
)

fun ActionSummary.toEntity(): ActionEntity = ActionEntity(
    id = id,
    leadId = leadId,
    actionTypeId = actionTypeId,
    userId = userId,
    payloadJson = payload.toString(),
    note = note,
    createdAt = createdAt,
)
