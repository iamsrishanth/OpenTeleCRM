package com.opentelecrm.core.sync

import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.core.database.ActionDao
import com.opentelecrm.core.database.PendingMutationDao
import com.opentelecrm.core.database.PendingMutationEntity
import com.opentelecrm.core.database.toEntity
import com.opentelecrm.core.model.ActionSummary
import com.opentelecrm.core.model.CreateActionItem
import com.opentelecrm.core.model.CreateActionsRequest
import com.opentelecrm.core.network.api.OpenTeleCrmApi
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import retrofit2.HttpException

/**
 * M2 offline-first action writer.
 *
 * createAction tries the API immediately; on network failure or 5xx it queues
 * a [PendingMutationEntity] (the outbox) and schedules a flush worker. 4xx
 * responses are surfaced to the user and NEVER queued (no idempotency key on
 * the API — retrying a 4xx would double-log). flushNow() replays the queue,
 * grouped per lead, with exponential backoff on transient failure.
 */
@Singleton
class ActionOutbox @Inject constructor(
    private val api: OpenTeleCrmApi,
    private val pendingDao: PendingMutationDao,
    private val actionDao: ActionDao,
    private val sessionManager: SessionManager,
    private val scheduler: WorkScheduler,
) {

    /** Number of actions waiting for the network — drives the offline badge. */
    val pendingCount: Flow<Int> = pendingDao.observePendingCount()

    sealed interface CreateResult {
        data class Success(val actionId: String) : CreateResult
        data class Queued(val pendingId: String) : CreateResult
        data class Rejected(val reason: String) : CreateResult
    }

    suspend fun createAction(
        leadId: String,
        type: String,
        note: String? = null,
        payload: JsonObject? = null,
    ): CreateResult {
        val eid = sessionManager.session.value?.enterpriseId
            ?: return CreateResult.Rejected("Not signed in")
        return try {
            val resp = api.createActions(
                eid,
                leadId,
                CreateActionsRequest(listOf(CreateActionItem(type = type, note = note, payload = payload))),
            )
            val item = resp.data.firstOrNull()
            when (item?.status) {
                "CREATED" -> {
                    val id = item.actionId.ifBlank { item.id }
                    // Optimistic cache write so the timeline shows it immediately.
                    actionDao.upsert(
                        ActionSummary(
                            id = id,
                            actionId = id,
                            leadId = leadId,
                            actionTypeId = item.typeId,
                            note = note,
                            createdAt = java.time.Instant.now().toString(),
                        ).toEntity(),
                    )
                    CreateResult.Success(id)
                }
                "IGNORED", "REJECTED" -> CreateResult.Rejected(
                    (item.remarks.takeIf { it.isNotEmpty() } ?: listOf(item.status)).joinToString(", "),
                )
                else -> CreateResult.Rejected("Unknown response")
            }
        } catch (e: HttpException) {
            if (e.code() in 400..499) {
                CreateResult.Rejected("Server rejected the action (HTTP ${e.code()})")
            } else {
                queue(eid, leadId, type, note, payload)
            }
        } catch (e: Exception) {
            queue(eid, leadId, type, note, payload)
        }
    }

    private suspend fun queue(
        eid: String,
        leadId: String,
        type: String,
        note: String?,
        payload: JsonObject?,
    ): CreateResult.Queued {
        val id = UUID.randomUUID().toString()
        val body = Json.encodeToString(
            CreateActionsRequest(listOf(CreateActionItem(type = type, note = note, payload = payload))),
        )
        pendingDao.insert(
            PendingMutationEntity(
                id = id,
                method = "POST",
                path = "/enterprise/$eid/lead/$leadId/action",
                bodyJson = body,
                leadId = leadId,
                actionType = type,
                attemptCount = 0,
                nextAttemptAt = 0,
                status = "pending",
            ),
        )
        scheduler.scheduleOneShot()
        return CreateResult.Queued(id)
    }

    /** Replays due outbox rows. Returns the number flushed (created or dropped as 4xx). */
    suspend fun flushNow(): Int {
        val eid = sessionManager.session.value?.enterpriseId ?: return 0
        val due = pendingDao.getDue(System.currentTimeMillis())
        if (due.isEmpty()) return 0

        var flushed = 0
        for ((leadId, mutations) in due.groupBy { it.leadId ?: "unknown" }) {
            val actions = mutations
                .mapNotNull { runCatching { Json.decodeFromString<CreateActionsRequest>(it.bodyJson) }.getOrNull() }
                .flatMap { it.actions }
            if (actions.isEmpty()) continue
            try {
                val resp = api.createActions(eid, leadId, CreateActionsRequest(actions))
                // Response items mirror the request order.
                resp.data.forEachIndexed { index, item ->
                    val mutation = mutations.getOrNull(index) ?: return@forEachIndexed
                    when (item.status) {
                        "CREATED", "IGNORED", "REJECTED" -> {
                            pendingDao.delete(mutation.id)
                            flushed++
                        }
                        else -> backoff(listOf(mutation))
                    }
                }
            } catch (e: HttpException) {
                if (e.code() in 400..499) {
                    // Server rejected the batch — drop, never retry.
                    mutations.forEach { pendingDao.delete(it.id) }
                    flushed += mutations.size
                } else {
                    backoff(mutations)
                }
            } catch (e: Exception) {
                backoff(mutations)
            }
        }
        return flushed
    }

    private suspend fun backoff(mutations: List<PendingMutationEntity>) {
        mutations.forEach { m ->
            val attempts = m.attemptCount + 1
            val delayMs = minOf(30_000L * (1L shl minOf(attempts, 6)), 30 * 60_000L)
            pendingDao.updateAttempt(m.id, attempts, System.currentTimeMillis() + delayMs, "pending")
        }
    }
}
