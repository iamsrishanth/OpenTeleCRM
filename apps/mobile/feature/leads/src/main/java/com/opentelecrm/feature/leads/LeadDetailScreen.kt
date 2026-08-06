package com.opentelecrm.feature.leads

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import com.opentelecrm.core.model.ActionSummary
import com.opentelecrm.core.model.LeadSummary
import kotlinx.serialization.json.JsonNull

/**
 * M2 lead detail entry point. Wired in [com.opentelecrm.app.navigation.AppNavHost]
 * as `leads/{leadId}`. Shows the lead header/details/meta plus an activity
 * timeline with a note/call/whatsapp composer.
 */
@Composable
fun LeadDetailRoute(
    leadId: String,
    onBack: () -> Unit,
    viewModel: LeadDetailViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(leadId) {
        viewModel.load(leadId)
        viewModel.refreshTimeline(leadId)
    }

    LeadDetailScreen(
        uiState = uiState,
        onBack = onBack,
        onRetry = { viewModel.load(leadId) },
        onAddNote = { text -> viewModel.addNote(leadId, text) },
        onLogCall = { viewModel.logCall(leadId) },
        onLogWhatsApp = { viewModel.logWhatsApp(leadId) },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LeadDetailScreen(
    uiState: LeadDetailUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onAddNote: (String) -> Unit,
    onLogCall: () -> Unit,
    onLogWhatsApp: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.lead?.customFieldString("name") ?: "Lead") },
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when {
                uiState.loading && uiState.lead == null -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.lead != null -> {
                    LeadContent(
                        lead = uiState.lead,
                        ownerName = uiState.ownerName,
                        timeline = uiState.timeline,
                        timelineLoading = uiState.timelineLoading,
                        actionError = uiState.actionError,
                        composing = uiState.composing,
                        pendingCount = uiState.pendingCount,
                        offlineRefreshError = uiState.error,
                        onRetry = onRetry,
                        onAddNote = onAddNote,
                        onLogCall = onLogCall,
                        onLogWhatsApp = onLogWhatsApp,
                        modifier = Modifier.fillMaxSize(),
                    )
                }
                uiState.error != null -> {
                    ErrorContent(
                        error = uiState.error,
                        onRetry = onRetry,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                else -> {
                    NotFoundContent(
                        onBack = onBack,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
            }
        }
    }
}

@Composable
private fun LeadContent(
    lead: LeadSummary,
    ownerName: String?,
    timeline: List<ActionSummary>,
    timelineLoading: Boolean,
    actionError: String?,
    composing: Boolean,
    pendingCount: Int,
    offlineRefreshError: String? = null,
    onRetry: () -> Unit = {},
    onRetryTimeline: () -> Unit = {},
    onAddNote: (String) -> Unit,
    onLogCall: () -> Unit,
    onLogWhatsApp: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        offlineRefreshError?.let { err ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                StatusBanner(message = err, isError = true, modifier = Modifier.weight(1f))
                TextButton(onClick = onRetry) { Text("Retry") }
            }
        }
        HeaderCard(lead)
        SectionCard(title = "Details") {
            lead.customFields.entries
                .filter { (key, value) -> key != "name" && value !is JsonNull }
                .forEach { (key, value) ->
                    KeyValueRow(label = key, value = value.toString())
                }
        }
        SectionCard(title = "Meta") {
            KeyValueRow(label = "Source", value = lead.source ?: "—")
            KeyValueRow(
                label = "Owner",
                value = ownerName ?: lead.ownerUserId?.take(8) ?: "—",
            )
            KeyValueRow(label = "Created", value = lead.createdAt ?: "—")
            KeyValueRow(label = "Updated", value = lead.updatedAt ?: "—")
        }
        SectionCard(title = "Activity") {
            ActivityComposer(
                composing = composing,
                pendingCount = pendingCount,
                onAddNote = onAddNote,
                onLogCall = onLogCall,
                onLogWhatsApp = onLogWhatsApp,
            )
            actionError?.let {
                Spacer(Modifier.height(8.dp))
                StatusBanner(message = it)
            }
            Spacer(Modifier.height(8.dp))
            if (timeline.isEmpty()) {
                if (timelineLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp))
                } else {
                    Text(
                        text = "No activity yet",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                timeline.forEach { action -> TimelineRow(action) }
            }
        }
    }
}

@Composable
private fun ActivityComposer(
    composing: Boolean,
    pendingCount: Int,
    onAddNote: (String) -> Unit,
    onLogCall: () -> Unit,
    onLogWhatsApp: () -> Unit,
) {
    var noteText by rememberSaveable { mutableStateOf("") }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = noteText,
            onValueChange = { noteText = it },
            placeholder = { Text("Add a note…") },
            modifier = Modifier.weight(1f),
            maxLines = 2,
        )
        Button(
            onClick = {
                onAddNote(noteText)
                noteText = ""
            },
            enabled = noteText.isNotBlank() && !composing,
        ) {
            Text("Add note")
        }
    }
    Spacer(Modifier.height(8.dp))
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedButton(onClick = onLogCall, enabled = !composing) {
            Text("Log call")
        }
        OutlinedButton(onClick = onLogWhatsApp, enabled = !composing) {
            Text("WhatsApp")
        }
        if (composing) {
            Spacer(Modifier.width(4.dp))
            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
        }
    }
    if (pendingCount > 0) {
        Spacer(Modifier.height(8.dp))
        Text(
            text = "$pendingCount action(s) pending sync",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun TimelineRow(action: ActionSummary) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(MaterialTheme.colorScheme.primary, CircleShape),
        )
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = action.note ?: action.actionTypeId ?: "Activity",
                style = MaterialTheme.typography.titleMedium,
            )
            action.createdAt?.let { created ->
                Text(
                    text = created,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HeaderCard(lead: LeadSummary) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = lead.customFieldString("name") ?: "Unnamed lead",
                    style = MaterialTheme.typography.headlineSmall,
                    modifier = Modifier.weight(1f),
                )
                val score = lead.score
                if (score != null) {
                    ScoreBadge(score = score)
                }
            }
            val phone = lead.identifier ?: lead.customFieldString("phone")
            if (phone != null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = phone,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (lead.tags.isNotEmpty()) {
                Spacer(Modifier.height(12.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    lead.tags.forEach { tag ->
                        AssistChip(onClick = {}, label = { Text(tag) })
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit,
) {
    Card(modifier = modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.height(8.dp))
            content()
        }
    }
}

@Composable
private fun KeyValueRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.4f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(0.6f),
        )
    }
}

@Composable
private fun ScoreBadge(score: Int) {
    Surface(
        color = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = score.toString(),
            style = MaterialTheme.typography.labelLarge,
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
        )
    }
}

@Composable
private fun ErrorContent(
    error: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        StatusBanner(message = error, isError = true)
        Spacer(Modifier.height(16.dp))
        Button(onClick = onRetry) {
            Text("Retry")
        }
    }
}

@Composable
private fun NotFoundContent(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "Lead not found",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(16.dp))
        Button(onClick = onBack) {
            Text("Back")
        }
    }
}
