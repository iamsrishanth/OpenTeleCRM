package com.opentelecrm.core.database

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface LeadDao {
    @Upsert
    suspend fun upsertAll(leads: List<LeadEntity>)

    @Query("SELECT * FROM lead_cache ORDER BY updatedAt DESC")
    fun observeAll(): Flow<List<LeadEntity>>

    @Query("SELECT * FROM lead_cache WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): LeadEntity?

    @Query("SELECT COUNT(*) FROM lead_cache")
    suspend fun count(): Int

    @Query("SELECT MAX(updatedAt) FROM lead_cache")
    suspend fun maxUpdatedAt(): String?

    @Query("DELETE FROM lead_cache")
    suspend fun clearAll()
}
