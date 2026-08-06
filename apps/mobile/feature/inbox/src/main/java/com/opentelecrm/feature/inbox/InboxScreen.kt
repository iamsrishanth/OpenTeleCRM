package com.opentelecrm.feature.inbox

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Send
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.opentelecrm.core.designsystem.component.StatusBanner
import com.opentelecrm.core.model.WhatsAppConversation
import com.opentelecrm.core.model.WhatsAppMessage
import com.opentelecrm.core.model.WhatsAppTemplate
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** M4 WhatsApp inbox route: conversation list, or the open thread when one is selected. */
@Composable
fun InboxRoute(
    onBack: () -> Unit,
    viewModel: InboxViewModel = hiltViewModel(),
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val threadState by viewModel.threadState.collectAsStateWithLifecycle()

    if (threadState.conversation != null) {
        ThreadScreen(
            threadState = threadState,
            onBack = viewModel::closeThread,
            onSend = viewModel::sendMessage,
        )
    } else {
        InboxListScreen(
            uiState = uiState,
            onBack = onBack,
            onOpenThread = viewModel::openThread,
            onRetry = viewModel::refresh,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun InboxListScreen(
    uiState: InboxViewModel.InboxUiState,
    onBack: () -> Unit,
    onOpenThread: (WhatsAppConversation) -> Unit,
    onRetry: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Inbox") },
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
                .padding(innerPadding),
        ) {
            if (uiState.error != null) {
                StatusBanner(message = uiState.error, isError = true)
                TextButton(
                    onClick = onRetry,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                ) {
                    Text("Retry")
                }
            }
            when {
                uiState.loading && uiState.conversations.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator()
                    }
                }
                uiState.conversations.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "No conversations yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(vertical = 8.dp),
                    ) {
                        items(uiState.conversations, key = { it.id }) { conversation ->
                            ConversationCard(
                                conversation = conversation,
                                onClick = { onOpenThread(conversation) },
                            )
                        }
                    }
                }
            }
        }
    }
}

/** One inbox row: contact name (or JID), last-message time, unread badge. */
@Composable
private fun ConversationCard(
    conversation: WhatsAppConversation,
    onClick: () -> Unit,
) {
    Card(
        onClick = onClick,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = conversation.contactName ?: conversation.contactJid ?: "Unknown contact",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = formatTimestamp(conversation.lastMessageAt),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if ((conversation.unreadCount ?: 0) > 0) {
                UnreadBadge(count = conversation.unreadCount ?: 0)
            }
        }
    }
}

/** Red dot + count, shown only for conversations with unread messages. */
@Composable
private fun UnreadBadge(count: Int) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color = MaterialTheme.colorScheme.error, shape = CircleShape),
        )
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.error,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ThreadScreen(
    threadState: InboxViewModel.ThreadUiState,
    onBack: () -> Unit,
    onSend: (String) -> Unit,
) {
    val conversation = threadState.conversation ?: return

    var composer by remember { mutableStateOf("") }
    var wasSending by remember { mutableStateOf(false) }

    // Clear the composer only when a send actually succeeded (sending flipped
    // true -> false without an error); on failure the draft is kept.
    LaunchedEffect(threadState.sending) {
        if (threadState.sending) {
            wasSending = true
        } else if (wasSending) {
            wasSending = false
            if (threadState.error == null) composer = ""
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(conversation.contactName ?: conversation.contactJid ?: "Inbox") },
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
                .padding(innerPadding),
        ) {
            if (threadState.error != null) {
                StatusBanner(message = threadState.error, isError = true)
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
            ) {
                when {
                    threadState.loading && threadState.messages.isEmpty() -> {
                        CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                    }
                    threadState.messages.isEmpty() -> {
                        Text(
                            text = "No messages yet",
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.align(Alignment.Center),
                        )
                    }
                    else -> {
                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            items(threadState.messages, key = { it.id }) { message ->
                                MessageBubble(message = message)
                            }
                        }
                    }
                }
            }
            TemplatePickerRow(
                templates = threadState.templates,
                onTemplateClick = { template ->
                    template.body?.let { body ->
                        composer = body.replace(
                            "{{1}}",
                            conversation.contactName ?: conversation.contactJid.orEmpty(),
                        )
                    }
                },
            )
            ComposerRow(
                text = composer,
                onTextChange = { composer = it },
                sending = threadState.sending,
                onSend = { onSend(composer) },
            )
        }
    }
}

/** Inbound left / outbound right bubble with body + small sent time. */
@Composable
private fun MessageBubble(message: WhatsAppMessage) {
    val isOutbound = message.direction == "outbound"
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isOutbound) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            color = if (isOutbound) {
                MaterialTheme.colorScheme.primaryContainer
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
            shape = RoundedCornerShape(12.dp),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Text(
                    text = message.body ?: "",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    text = formatTimestamp(message.sentAt ?: message.createdAt),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.align(Alignment.End),
                )
            }
        }
    }
}

/** Horizontal template chips; tapping one drops its body into the composer. */
@Composable
private fun TemplatePickerRow(
    templates: List<WhatsAppTemplate>,
    onTemplateClick: (WhatsAppTemplate) -> Unit,
) {
    if (templates.isEmpty()) return
    LazyRow(
        contentPadding = PaddingValues(horizontal = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items(templates, key = { it.name }) { template ->
            FilterChip(
                selected = false,
                onClick = { onTemplateClick(template) },
                label = { Text(template.name) },
            )
        }
    }
}

/** Composer: text field + send button, both disabled while a send is in flight. */
@Composable
private fun ComposerRow(
    text: String,
    onTextChange: (String) -> Unit,
    sending: Boolean,
    onSend: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = text,
            onValueChange = onTextChange,
            modifier = Modifier.weight(1f),
            placeholder = { Text("Type a message…") },
            enabled = !sending,
            maxLines = 4,
        )
        Spacer(Modifier.width(8.dp))
        IconButton(
            onClick = onSend,
            enabled = text.isNotBlank() && !sending,
        ) {
            Icon(
                imageVector = Icons.Filled.Send,
                contentDescription = "Send",
            )
        }
    }
}

/** Compact time display: "HH:mm" for today, "MMM d" otherwise; raw string as fallback. */
private fun formatTimestamp(raw: String?): String {
    if (raw.isNullOrBlank()) return ""
    val parsed = runCatching { OffsetDateTime.parse(raw) }.getOrNull()
        ?: runCatching { Instant.parse(raw).atZone(ZoneId.systemDefault()).toOffsetDateTime() }.getOrNull()
        ?: return raw
    val now = OffsetDateTime.now()
    return if (parsed.toLocalDate() == now.toLocalDate()) {
        parsed.format(TIME_FORMAT)
    } else {
        parsed.format(DATE_FORMAT)
    }
}

private val TIME_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("HH:mm")
private val DATE_FORMAT: DateTimeFormatter = DateTimeFormatter.ofPattern("MMM d")
