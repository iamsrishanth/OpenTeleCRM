package com.opentelecrm.core.database

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/** One queued mutation waiting for the network — the M2 offline outbox. */
@Entity(
    tableName = "pending_mutation",
    indices = [Index("leadId"), Index("status")],
)
data class PendingMutationEntity(
    @PrimaryKey val id: String, // local UUID
    val method: String, // POST
    val path: String, // full API path incl. /autoupdate/v2 prefix
    val bodyJson: String,
    val leadId: String? = null,
    val actionType: String = "note",
    val attemptCount: Int = 0,
    val nextAttemptAt: Long = 0, // epoch millis; 0 = due now
    val status: String = "pending", // pending | failed
    val createdAt: Long = System.currentTimeMillis(),
)
