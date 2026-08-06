package com.opentelecrm.feature.leads

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import com.opentelecrm.core.model.LeadSummary
import com.opentelecrm.core.model.TeamMember
import kotlinx.coroutines.CancellationException

/**
 * M1 leads list: search, team filter chips, sync status, and the lead cards.
 * Theme (OpenTeleCRMTheme) is applied at app level.
 *
 * @param onLeadClick invoked with the lead id when a card is tapped.
 */
@Composable
fun LeadsRoute(
    onLeadClick: (String) -> Unit,
    onOpenTeam: () -> Unit,
    onOpenDialer: () -> Unit,
    onOpenSettings: () -> Unit,
    viewModel: LeadsListViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    var teamMembers by remember { mutableStateOf<List<TeamMember>?>(null) }
    LaunchedEffect(Unit) {
        viewModel.refresh() // auto-refresh on first composition
        teamMembers = try {
            viewModel.teamMembers()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            emptyList()
        }
    }

    LeadsListScreen(
        uiState = uiState,
        teamMembers = teamMembers,
        onQueryChange = viewModel::onQueryChange,
        onTeamFilterChange = viewModel::setTeamFilter,
        onRefresh = viewModel::refresh,
        onRetrySync = viewModel::retrySync,
        onLeadClick = onLeadClick,
        onOpenTeam = onOpenTeam,
        onOpenDialer = onOpenDialer,
        onOpenSettings = onOpenSettings,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LeadsListScreen(
    uiState: LeadsListViewModel.LeadsUiState,
    teamMembers: List<TeamMember>?,
    onQueryChange: (String) -> Unit,
    onTeamFilterChange: (String?) -> Unit,
    onRefresh: () -> Unit,
    onRetrySync: () -> Unit,
    onLeadClick: (String) -> Unit,
    onOpenTeam: () -> Unit,
    onOpenDialer: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Leads") },
                actions = {
                    TextButton(onClick = onOpenTeam) { Text("Team") }
                    TextButton(onClick = onOpenDialer) { Text("Dialer") }
                    TextButton(onClick = onOpenSettings) { Text("Settings") }
                    if (uiState.refreshing) {
                        CircularProgressIndicator(
                            modifier = Modifier
                                .padding(end = 16.dp)
                                .size(20.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        IconButton(onClick = onRefresh) {
                            Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
                        }
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            OutlinedTextField(
                value = uiState.query,
                onValueChange = onQueryChange,
                placeholder = { Text("Search leads") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
            )

            uiState.syncedCount?.let { count ->
                Text(
                    text = "Synced $count leads",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp),
                )
            }

            if (!uiState.isOnline) {
                StatusBanner(
                    message = "Offline — changes will sync when you reconnect",
                    isError = false,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            if (uiState.pendingCount > 0) {
                // Compact outbox badge; WorkManager's worker also flushes on reconnect.
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 4.dp),
                    shape = MaterialTheme.shapes.small,
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ) {
                    Row(
                        modifier = Modifier.padding(start = 12.dp, end = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "${uiState.pendingCount} changes queued",
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.weight(1f),
                        )
                        TextButton(onClick = onRetrySync) { Text("Sync now") }
                    }
                }
            }

            if (teamMembers != null && teamMembers.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    item {
                        FilterChip(
                            selected = uiState.teamFilter == null,
                            onClick = { onTeamFilterChange(null) },
                            label = { Text("All") },
                        )
                    }
                    items(teamMembers, key = { it.id }) { member ->
                        FilterChip(
                            selected = uiState.teamFilter == member.id,
                            onClick = { onTeamFilterChange(member.id) },
                            label = { Text(member.name) },
                        )
                    }
                }
            }

            uiState.error?.let { message ->
                StatusBanner(message = message, isError = true)
            }

            when {
                uiState.loading && uiState.leads.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }

                uiState.leads.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Text(
                            text = "No leads yet — pull to refresh",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (uiState.error != null) {
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = onRefresh) { Text("Retry") }
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(uiState.leads, key = { it.id }) { lead ->
                            LeadCard(lead = lead, onClick = { onLeadClick(lead.id) })
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LeadCard(lead: LeadSummary, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = lead.customFieldString("name") ?: lead.identifier ?: "Unnamed lead",
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                lead.score?.let { score ->
                    ScoreBadge(score = score)
                }
            }

            val subtitle = listOfNotNull(
                lead.customFieldString("city"),
                lead.source,
            ).joinToString(" · ")
            if (subtitle.isNotBlank()) {
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (!lead.source.isNullOrBlank() || lead.tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    lead.source?.takeIf { it.isNotBlank() }?.let { source ->
                        Text(
                            text = source,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.align(Alignment.CenterVertically),
                        )
                    }
                    lead.tags.take(3).forEach { tag ->
                        AssistChip(onClick = {}, label = { Text(tag) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ScoreBadge(score: Int) {
    val backgroundColor = when {
        score >= 70 -> Color(0xFF16A34A) // green-ish
        score >= 40 -> Color(0xFFF59E0B) // amber
        else -> Color(0xFF94A3B8) // grey
    }
    Surface(
        color = backgroundColor,
        contentColor = Color.White,
        shape = MaterialTheme.shapes.small,
    ) {
        Text(
            text = score.toString(),
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}
