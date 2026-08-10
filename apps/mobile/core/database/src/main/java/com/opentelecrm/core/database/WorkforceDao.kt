package com.opentelecrm.core.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AttendanceDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<AttendanceEntity>)

    @Query("SELECT * FROM attendance_cache ORDER BY workDate DESC LIMIT 60")
    fun observeAll(): Flow<List<AttendanceEntity>>

    @Query("SELECT * FROM attendance_cache WHERE workDate = :workDate LIMIT 1")
    suspend fun getByWorkDate(workDate: String): AttendanceEntity?

    @Query("DELETE FROM attendance_cache")
    suspend fun clearAll()
}

@Dao
interface EodDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<EodEntity>)

    @Query("SELECT * FROM eod_cache ORDER BY reportDate DESC LIMIT 30")
    fun observeAll(): Flow<List<EodEntity>>

    @Query("SELECT * FROM eod_cache WHERE reportDate = :reportDate LIMIT 1")
    suspend fun getByReportDate(reportDate: String): EodEntity?

    @Query("DELETE FROM eod_cache")
    suspend fun clearAll()
}

@Dao
interface TaskDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(rows: List<TaskEntity>)

    @Query("SELECT * FROM task_cache ORDER BY dueDate ASC")
    fun observeAll(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM task_cache WHERE id = :id LIMIT 1")
    suspend fun getById(id: String): TaskEntity?

    @Query("UPDATE task_cache SET status = :status, completedAt = :completedAt WHERE id = :id")
    suspend fun updateStatus(id: String, status: String, completedAt: String?)

    @Query("DELETE FROM task_cache")
    suspend fun clearAll()
}

@Dao
interface DeviceCallDao {
    @Insert
    suspend fun insertAll(rows: List<DeviceCallEntity>)

    @Query("SELECT * FROM device_call_cache WHERE synced = 0 ORDER BY startedAt ASC LIMIT :limit")
    suspend fun getUnsynced(limit: Int = 200): List<DeviceCallEntity>

    @Query("UPDATE device_call_cache SET synced = 1 WHERE localId IN (:ids)")
    suspend fun markSynced(ids: List<Long>)

    @Query("SELECT COUNT(*) FROM device_call_cache WHERE synced = 0")
    fun observeUnsyncedCount(): Flow<Int>

    @Query("SELECT * FROM device_call_cache ORDER BY startedAt DESC LIMIT 50")
    fun observeRecent(): Flow<List<DeviceCallEntity>>

    @Query("DELETE FROM device_call_cache")
    suspend fun clearAll()
}
