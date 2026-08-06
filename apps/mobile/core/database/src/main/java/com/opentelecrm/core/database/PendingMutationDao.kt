package com.opentelecrm.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface PendingMutationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(mutation: PendingMutationEntity)

    @Query("SELECT * FROM pending_mutation WHERE status = 'pending' AND nextAttemptAt <= :now ORDER BY createdAt ASC")
    suspend fun getDue(now: Long): List<PendingMutationEntity>

    @Query("SELECT * FROM pending_mutation WHERE status = 'pending' ORDER BY createdAt ASC")
    suspend fun getAllPending(): List<PendingMutationEntity>

    @Query("SELECT COUNT(*) FROM pending_mutation WHERE status = 'pending'")
    fun observePendingCount(): Flow<Int>

    @Query("DELETE FROM pending_mutation WHERE id = :id")
    suspend fun delete(id: String)

    @Query("UPDATE pending_mutation SET attemptCount = :attempts, nextAttemptAt = :nextAttemptAt, status = :status WHERE id = :id")
    suspend fun updateAttempt(id: String, attempts: Int, nextAttemptAt: Long, status: String)

    @Query("DELETE FROM pending_mutation WHERE leadId = :leadId AND status != 'pending'")
    suspend fun clearSettledForLead(leadId: String)
}
