package com.opentelecrm.core.database

import androidx.room.Database
import androidx.room.RoomDatabase

/**
 * App-wide Room database. Holds only sync bookkeeping for now (delta-sync cursors, M1);
 * domain data is fetched fresh from the server per session.
 */
@Database(
    entities = [SyncStateEntity::class, LeadEntity::class, ActionEntity::class, PendingMutationEntity::class],
    version = 3,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun syncStateDao(): SyncStateDao
    abstract fun leadDao(): LeadDao
    abstract fun actionDao(): ActionDao
    abstract fun pendingMutationDao(): PendingMutationDao
}
