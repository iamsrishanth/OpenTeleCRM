package com.opentelecrm.feature.attendance

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.database.AttendanceEntity
import com.opentelecrm.feature.attendance.data.AttendanceRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * M4 attendance: Room cache as source of truth. Check-in/out punch the API and
 * upsert the returned row; `today` is derived from the cached history so the
 * button state reacts to the DAO flow (works offline after the first sync).
 */
@HiltViewModel
class AttendanceViewModel @Inject constructor(
    private val repository: AttendanceRepository,
) : ViewModel() {

    data class AttendanceUiState(
        val history: List<AttendanceEntity> = emptyList(),
        val today: AttendanceEntity? = null,
        val busy: Boolean = false,
        val error: String? = null,
    )

    private val _uiState = MutableStateFlow(AttendanceUiState())
    val uiState: StateFlow<AttendanceUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.attendance.collect { rows ->
                _uiState.update {
                    it.copy(history = rows, today = rows.firstOrNull { row -> isToday(row.workDate) })
                }
            }
        }
        refresh()
    }

    /** Punches in with the current GPS fix (lat/lng may be null when unavailable). */
    fun checkIn(lat: Double?, lng: Double?) = punch(isCheckIn = true, lat = lat, lng = lng)

    /** Punches out with the current GPS fix (lat/lng may be null when unavailable). */
    fun checkOut(lat: Double?, lng: Double?) = punch(isCheckIn = false, lat = lat, lng = lng)

    private fun punch(isCheckIn: Boolean, lat: Double?, lng: Double?) {
        if (_uiState.value.busy) return
        viewModelScope.launch {
            _uiState.update { it.copy(busy = true, error = null) }
            try {
                if (isCheckIn) repository.checkIn(lat, lng) else repository.checkOut(lat, lng)
                _uiState.update { it.copy(busy = false) }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        busy = false,
                        error = e.message ?: (if (isCheckIn) "Check-in failed" else "Check-out failed"),
                    )
                }
            }
        }
    }

    /** Pulls attendance history from the API into the Room cache. */
    fun refresh() {
        viewModelScope.launch {
            try {
                repository.refresh()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Offline / not signed in — the cached history stays visible.
            }
        }
    }

    /** Server workDate is "YYYY-MM-DD" (sometimes an ISO datetime) — match today's date prefix. */
    private fun isToday(workDate: String): Boolean {
        val today = LocalDate.now().toString()
        return workDate == today || workDate.startsWith(today)
    }
}
