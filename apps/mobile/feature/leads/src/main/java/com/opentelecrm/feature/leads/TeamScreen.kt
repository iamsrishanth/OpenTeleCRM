package com.opentelecrm.feature.leads

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import com.opentelecrm.core.model.TeamMember

/** Roster sort key: available, then busy, then offline (string compare). */
private val TeamMember.sortKey: String
    get() = availability?.lowercase() ?: "offline"

/** Team roster screen. */
@Composable
fun TeamRoute(
    onBack: () -> Unit,
    viewModel: TeamViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    TeamScreen(
        uiState = uiState,
        onBack = onBack,
        onRetry = viewModel::retry,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TeamScreen(
    uiState: TeamUiState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Team") },
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
                uiState.loading && uiState.members.isEmpty() -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                uiState.error != null && uiState.members.isEmpty() -> {
                    Column(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        StatusBanner(message = uiState.error, isError = true)
                        Spacer(Modifier.height(16.dp))
                        Button(onClick = onRetry) { Text("Retry") }
                    }
                }
                uiState.members.isEmpty() -> {
                    Text(
                        text = "No team members",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.align(Alignment.Center),
                    )
                }
                else -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        if (uiState.error != null) {
                            StatusBanner(message = uiState.error, isError = true)
                            Spacer(Modifier.height(8.dp))
                            Button(
                                onClick = onRetry,
                                modifier = Modifier.padding(horizontal = 16.dp),
                            ) {
                                Text("Retry")
                            }
                            Spacer(Modifier.height(8.dp))
                        }
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            items(uiState.members.sortedBy { it.sortKey }, key = { it.id }) { member ->
                                TeamMemberCard(member = member)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TeamMemberCard(member: TeamMember) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Avatar(initials = member.initials())
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = member.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = member.email,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                AvailabilityChip(status = member.availability)
                member.role?.name?.let { roleName ->
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = roleName,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (member.skills.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    SkillChips(skills = member.skills)
                }
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Capacity ${member.capacity ?: 0}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun Avatar(initials: String) {
    Surface(
        modifier = Modifier.size(44.dp),
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = initials,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}

private enum class Availability(val label: String, val color: Color) {
    Available("Available", Color(0xFF2E7D32)),
    Busy("Busy", Color(0xFFF9A825)),
    Offline("Offline", Color(0xFF9E9E9E)),
}

private fun availabilityStatus(raw: String?): Availability = when (raw?.lowercase()) {
    "available" -> Availability.Available
    "busy" -> Availability.Busy
    else -> Availability.Offline
}

@Composable
private fun AvailabilityChip(status: String?) {
    val availability = availabilityStatus(status)
    Surface(
        shape = RoundedCornerShape(50),
        color = availability.color.copy(alpha = 0.12f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(color = availability.color, shape = CircleShape),
            )
            Spacer(Modifier.width(6.dp))
            Text(
                text = availability.label,
                style = MaterialTheme.typography.labelMedium,
                color = availability.color,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SkillChips(skills: List<String>) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        skills.forEach { skill ->
            AssistChip(onClick = {}, label = { Text(skill) })
        }
    }
}

/** First letters of first and last name; falls back to the first two characters. */
private fun TeamMember.initials(): String {
    val parts = name.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
    return when {
        parts.size >= 2 -> parts.first().first().uppercase() + parts.last().first().uppercase()
        parts.size == 1 -> parts.first().take(2).uppercase()
        else -> "?"
    }
}
