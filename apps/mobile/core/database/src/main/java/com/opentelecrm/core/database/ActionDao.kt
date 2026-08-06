package com.opentelecrm.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface ActionDao {
    @Upsert
    suspend fun upsertAll(actions: List<ActionEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(action: ActionEntity)

    @Query("SELECT * FROM action_cache WHERE leadId = :leadId ORDER BY createdAt DESC")
    fun observeByLead(leadId: String): Flow<List<ActionEntity>>

    @Query("DELETE FROM action_cache")
    suspend fun clearAll()
}
