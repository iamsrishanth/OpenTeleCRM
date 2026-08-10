package com.opentelecrm.feature.attendance

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.database.AttendanceEntity
import com.opentelecrm.core.designsystem.component.StatusBanner

/**
 * M4 attendance: today's punch status (GPS check-in/check-out) + the cached
 * history from AttendanceDao. Theme (OpenTeleCRMTheme) is applied at app level.
 */
@Composable
fun AttendanceRoute(
    onBack: () -> Unit,
    viewModel: AttendanceViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    // ACCESS_FINE_LOCATION runtime request; the punch is deferred until granted
    // so the first tap still goes through (otherwise lat/lng are sent as null).
    var pendingPunch by remember { mutableStateOf<PunchKind?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) pendingPunch?.let { punchWithLocation(context, it, viewModel) }
        pendingPunch = null
    }
    fun punch(kind: PunchKind) {
        if (hasLocationPermission(context)) {
            punchWithLocation(context, kind, viewModel)
        } else {
            pendingPunch = kind
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }
    }

    AttendanceScreen(
        uiState = uiState,
        onBack = onBack,
        onRefresh = viewModel::refresh,
        onCheckIn = { punch(PunchKind.CHECK_IN) },
        onCheckOut = { punch(PunchKind.CHECK_OUT) },
    )
}

private enum class PunchKind { CHECK_IN, CHECK_OUT }

/** Reads the last known location (may be null) and punches via the ViewModel. */
private fun punchWithLocation(context: Context, kind: PunchKind, viewModel: AttendanceViewModel) {
    val (lat, lng) = lastKnownLocation(context)
    when (kind) {
        PunchKind.CHECK_IN -> viewModel.checkIn(lat, lng)
        PunchKind.CHECK_OUT -> viewModel.checkOut(lat, lng)
    }
}

/** FINE preferred; COARSE also counts (manifest declares both) — null coords otherwise. */
private fun hasLocationPermission(context: Context): Boolean =
    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

/** Last known fix from GPS or network provider; nulls when unavailable. */
private fun lastKnownLocation(context: Context): Pair<Double?, Double?> {
    val manager = context.getSystemService(LocationManager::class.java) ?: return null to null
    for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
        try {
            val fix = manager.getLastKnownLocation(provider) ?: continue
            return fix.latitude to fix.longitude
        } catch (e: SecurityException) {
            return null to null
        } catch (e: Exception) {
            // Provider disabled or unknown — try the next one.
        }
    }
    return null to null
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AttendanceScreen(
    uiState: AttendanceViewModel.AttendanceUiState,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onCheckIn: () -> Unit,
    onCheckOut: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Attendance") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = onRefresh) { Icon(Icons.Filled.Refresh, "Refresh") }
                },
            )
        },
    ) { innerPadding ->
        Column(Modifier.fillMaxSize().padding(innerPadding)) {
            TodayCard(
                today = uiState.today,
                busy = uiState.busy,
                onCheckIn = onCheckIn,
                onCheckOut = onCheckOut,
            )
            uiState.error?.let {
                StatusBanner(it, Modifier.padding(horizontal = 16.dp, vertical = 4.dp), isError = true)
            }
            Text(
                "History",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            if (uiState.history.isEmpty()) {
                Box(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                    Text(
                        "No attendance records yet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                LazyColumn(
                    Modifier.fillMaxWidth().weight(1f),
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(uiState.history, key = { it.id }) { row ->
                        HistoryCard(row)
                    }
                }
            }
        }
    }
}

@Composable
private fun TodayCard(
    today: AttendanceEntity?,
    busy: Boolean,
    onCheckIn: () -> Unit,
    onCheckOut: () -> Unit,
) {
    val checkedIn = today?.checkInAt != null
    val checkedOut = today?.checkOutAt != null
    val inTime = today?.checkInAt?.let { timeOf(it) }
    val outTime = today?.checkOutAt?.let { timeOf(it) }
    Card(Modifier.fillMaxWidth().padding(16.dp)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Today", style = MaterialTheme.typography.titleMedium)
            Text(
                when {
                    checkedIn && checkedOut -> "Completed · in ${inTime ?: "—"} · out ${outTime ?: "—"}"
                    checkedIn -> "Checked in at ${inTime ?: "—"}"
                    else -> "Not checked in yet"
                },
                style = MaterialTheme.typography.bodyLarge,
            )
            today?.totalHours?.takeIf { it.isNotBlank() }?.let {
                Text("Total hours: $it", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Button(onClick = onCheckIn, enabled = !busy && !checkedIn, modifier = Modifier.weight(1f)) {
                    Text(if (busy && !checkedIn) "Checking in…" else "Check in")
                }
                OutlinedButton(onClick = onCheckOut, enabled = !busy && checkedIn && !checkedOut, modifier = Modifier.weight(1f)) {
                    Text(if (busy && checkedIn && !checkedOut) "Checking out…" else "Check out")
                }
            }
        }
    }
}

@Composable
private fun HistoryCard(row: AttendanceEntity) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = row.workDate,
                    style = MaterialTheme.typography.titleSmall,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = row.status.ifBlank { if (row.checkOutAt != null) "completed" else "open" },
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            val punches = listOfNotNull(
                row.checkInAt?.let { timeOf(it)?.let { t -> "In $t" } },
                row.checkOutAt?.let { timeOf(it)?.let { t -> "Out $t" } },
                row.totalHours?.takeIf { it.isNotBlank() }?.let { "$it h" },
            ).joinToString(" · ")
            Text(
                text = punches.ifBlank { "No punches" },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Extracts "HH:mm" from ISO timestamps ("2026-08-10T09:02:33Z"); null for plain dates. */
private fun timeOf(value: String?): String? {
    if (value.isNullOrBlank()) return null
    val time = value.substringAfterLast('T', value).substringAfterLast(' ', value)
    return if (time.length >= 5 && !time.contains('-')) time.take(5) else null
}
