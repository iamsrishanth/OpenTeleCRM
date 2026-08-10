package com.opentelecrm.core.database

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * Workforce cache rows (ByteCodeEMS port, M4). All mirrors of the API DTOs;
 * `dirty` marks locally-created rows awaiting sync (offline punch/EOD).
 */
@Entity(tableName = "attendance_cache")
data class AttendanceEntity(
    @PrimaryKey val id: String,
    val workDate: String,
    val checkInAt: String? = null,
    val checkOutAt: String? = null,
    val status: String = "",
    val totalHours: String? = null,
    val source: String = "mobile",
    val dirty: Boolean = false,
)

@Entity(tableName = "eod_cache")
data class EodEntity(
    @PrimaryKey val id: String,
    val reportDate: String,
    val summary: String,
    val hoursWorked: String? = null,
    val status: String = "",
    val submittedAt: String? = null,
    val dirty: Boolean = false,
)

@Entity(tableName = "task_cache")
data class TaskEntity(
    @PrimaryKey val id: String,
    val title: String,
    val description: String? = null,
    val assignedToMemberId: String = "",
    val priority: String = "medium",
    val status: String = "todo",
    val dueDate: String? = null,
    val completedAt: String? = null,
    val dirty: Boolean = false,
)

/** Device call-log row pending upload (mirrors POST /device-calls). */
@Entity(tableName = "device_call_cache")
data class DeviceCallEntity(
    @PrimaryKey(autoGenerate = true) val localId: Long = 0,
    val phoneNumber: String,
    val callType: String,
    val durationSec: Int = 0,
    val startedAt: String,
    val simSlot: String? = null,
    val simCarrier: String? = null,
    val synced: Boolean = false,
)
