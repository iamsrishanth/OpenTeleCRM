package com.opentelecrm.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface SyncStateDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(state: SyncStateEntity)

    @Query("SELECT * FROM sync_state")
    suspend fun getAll(): List<SyncStateEntity>

    @Query("DELETE FROM sync_state")
    suspend fun clearAll()
}
