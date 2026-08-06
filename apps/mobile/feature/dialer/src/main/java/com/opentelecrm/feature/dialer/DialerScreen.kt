package com.opentelecrm.feature.dialer

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import com.opentelecrm.core.model.DialerCandidate
import com.opentelecrm.core.model.Dispositions
import java.time.Instant
import java.time.OffsetDateTime
import kotlinx.coroutines.delay

/** M3 dialer call pad route. */
@Composable
fun DialerRoute(
    onBack: () -> Unit,
    viewModel: DialerViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    // POST_NOTIFICATIONS runtime request (Android 13+); the sibling
    // CallForegroundService posts the in-call notification.
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        viewModel.setPermissionGranted(granted)
    }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    DialerScreen(
        uiState = uiState,
        onBack = onBack,
        onDial = viewModel::dial,
        onSkip = viewModel::skip,
        onRefresh = viewModel::loadNext,
        onEndCall = viewModel::endCall,
        onDispositionNoteChange = viewModel::onDispositionNoteChange,
        onSubmitDisposition = viewModel::submitDisposition,
        onScheduleCallback = { viewModel.scheduleCallback("tomorrow_10am") },
    )
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun DialerScreen(
    uiState: DialerViewModel.DialerUiState,
    onBack: () -> Unit,
    onDial: () -> Unit,
    onSkip: () -> Unit,
    onRefresh: () -> Unit,
    onEndCall: () -> Unit,
    onDispositionNoteChange: (String) -> Unit,
    onSubmitDisposition: (String) -> Unit,
    onScheduleCallback: () -> Unit,
) {
    val inCall = uiState.inCall

    var showDisposition by remember { mutableStateOf(false) }
    var chosenDisposition by remember { mutableStateOf<String?>(null) }

    // Surface the disposition sheet once the call has ended (auto or via End call).
    LaunchedEffect(inCall?.endedAt) {
        if (inCall?.endedAt != null && inCall?.activeCallId != null) {
            showDisposition = true
        }
    }
    // Reset sheet-local state when the session is cleared after disposition save.
    LaunchedEffect(inCall?.activeCallId) {
        if (inCall == null) {
            showDisposition = false
            chosenDisposition = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Dialer") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                        )
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            TraiWindowBanner()

            if (uiState.error != null) {
                StatusBanner(message = uiState.error, isError = true)
            }

            when {
                uiState.loading && uiState.candidate == null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(160.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.candidate == null && inCall?.activeCallId == null -> {
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "No candidates right now",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        TextButton(onClick = onRefresh) { Text("Refresh") }
                    }
                }
                else -> {
                    uiState.candidate?.let { candidate ->
                        CandidateCard(candidate = candidate)
                        DialActions(
                            dialing = uiState.dialing,
                            inCallActive = inCall?.isActive() == true,
                            candidateAvailable = true,
                            onDial = onDial,
                            onSkip = onSkip,
                        )
                    }
                }
            }

            if (inCall?.activeCallId != null) {
                InCallCard(
                    inCall = inCall,
                    onEndCall = onEndCall,
                )
            }
        }
    }

    if (showDisposition && inCall?.activeCallId != null) {
        ModalBottomSheet(onDismissRequest = { showDisposition = false }) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(bottom = 24.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(
                    text = "Call disposition",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Dispositions.ALL.forEach { disposition ->
                        FilterChip(
                            selected = chosenDisposition == disposition,
                            onClick = { chosenDisposition = disposition },
                            label = { Text(dispositionLabel(disposition)) },
                        )
                    }
                }
                OutlinedTextField(
                    value = uiState.dispositionNote ?: "",
                    onValueChange = onDispositionNoteChange,
                    label = { Text("Note (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                )
                if (chosenDisposition == Dispositions.CALLBACK) {
                    OutlinedButton(
                        onClick = {
                            showDisposition = false
                            onScheduleCallback()
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Schedule callback (tomorrow 10am)")
                    }
                }
                Button(
                    onClick = {
                        chosenDisposition?.let { disposition ->
                            showDisposition = false
                            onSubmitDisposition(disposition)
                        }
                    },
                    enabled = chosenDisposition != null,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Save disposition")
                }
            }
        }
    }
}

/** Informational TRAI calling-window banner — always visible. */
@Composable
private fun TraiWindowBanner() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.tertiaryContainer,
        contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
    ) {
        Text(
            text = "Calling window 09:00–21:00",
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
        )
    }
}

/** Next-candidate card: phone, score badge, reasons. Candidates carry no customFields. */
@Composable
private fun CandidateCard(candidate: DialerCandidate) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = candidate.phone ?: candidate.identifier ?: "Unknown number",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                val secondaryId = candidate.identifier
                if (secondaryId != null && secondaryId != candidate.phone) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = secondaryId,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (candidate.reasons.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    candidate.reasons.take(3).forEach { reason ->
                        Text(
                            text = "• $reason",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Spacer(Modifier.width(12.dp))
            ScoreBadge(score = candidate.score ?: candidate.leadScore)
        }
    }
}

@Composable
private fun ScoreBadge(score: Int?) {
    Surface(
        modifier = Modifier.size(44.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = score?.toString() ?: "—",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
        }
    }
}

@Composable
private fun DialActions(
    dialing: Boolean,
    inCallActive: Boolean,
    candidateAvailable: Boolean,
    onDial: () -> Unit,
    onSkip: () -> Unit,
) {
    val actionsEnabled = candidateAvailable && !dialing && !inCallActive
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Button(
            onClick = onDial,
            enabled = actionsEnabled,
            modifier = Modifier.weight(1f),
        ) {
            if (dialing) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp,
                    color = LocalContentColor.current,
                )
                Spacer(Modifier.width(8.dp))
            }
            Text(if (dialing) "Dialing…" else "Dial")
        }
        TextButton(onClick = onSkip, enabled = actionsEnabled) {
            Text("Skip")
        }
    }
}

/** Live call card: phone, status, elapsed time, End call. */
@Composable
private fun InCallCard(
    inCall: CallState,
    onEndCall: () -> Unit,
) {
    val ended = inCall.endedAt != null

    val elapsedSec by produceState(
        initialValue = 0L,
        key1 = inCall.startedAt,
        key2 = inCall.endedAt,
    ) {
        while (true) {
            value = elapsedSeconds(inCall.startedAt, inCall.endedAt)
            if (ended) break
            delay(1_000)
        }
    }

    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
        ) {
            Text(
                text = if (ended) "Call ended" else "In call",
                style = MaterialTheme.typography.titleMedium,
                color = if (ended) {
                    MaterialTheme.colorScheme.onSurfaceVariant
                } else {
                    MaterialTheme.colorScheme.primary
                },
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = inCall.candidate?.phone
                    ?: inCall.candidate?.identifier
                    ?: "Unknown number",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = inCall.callStatus ?: "connecting…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "Elapsed ${formatElapsed(elapsedSec)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (!ended) {
                Spacer(Modifier.height(12.dp))
                Button(
                    onClick = onEndCall,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("End call")
                }
            }
        }
    }
}

/** "no_answer" -> "No answer"; "dnc" -> "DNC". */
private fun dispositionLabel(disposition: String): String {
    if (disposition == Dispositions.DNC) return "DNC"
    return disposition.split('_').joinToString(" ") { part ->
        part.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}

/** Elapsed wall time between startedAt and endedAt (or now while live). */
private fun elapsedSeconds(startedAt: String?, endedAt: String?): Long {
    val start = parseInstant(startedAt) ?: return 0L
    val end = parseInstant(endedAt) ?: Instant.now()
    return ((end.toEpochMilli() - start.toEpochMilli()) / 1000).coerceAtLeast(0L)
}

private fun parseInstant(value: String?): Instant? {
    if (value.isNullOrBlank()) return null
    return try {
        OffsetDateTime.parse(value).toInstant()
    } catch (e: Exception) {
        try {
            Instant.parse(value)
        } catch (e2: Exception) {
            null
        }
    }
}

private fun formatElapsed(totalSeconds: Long): String {
    val minutes = totalSeconds / 60
    val seconds = totalSeconds % 60
    return "%02d:%02d".format(minutes, seconds)
}
