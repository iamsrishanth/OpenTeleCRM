package com.opentelecrm.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * One row per syncable entity type, tracking the server-side delta-sync cursor (M1).
 * `cursor` is an opaque token returned by the server; `lastSyncAt` is the epoch millis
 * of the last successful sync.
 */
@Entity(tableName = "sync_state")
data class SyncStateEntity(
    @PrimaryKey val entity: String,
    val cursor: String,
    val lastSyncAt: Long,
)
