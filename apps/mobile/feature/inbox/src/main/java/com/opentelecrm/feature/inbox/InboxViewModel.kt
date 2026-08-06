package com.opentelecrm.feature.inbox

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.opentelecrm.core.model.WhatsAppConversation
import com.opentelecrm.core.model.WhatsAppMessage
import com.opentelecrm.core.model.WhatsAppTemplate
import com.opentelecrm.feature.inbox.data.InboxRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.Instant
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * M4 WhatsApp inbox: conversation list plus the selected thread (messages,
 * templates, composer send). Both are live API reads; the thread appends a
 * local outbound copy on a successful send.
 */
@HiltViewModel
class InboxViewModel @Inject constructor(
    private val repository: InboxRepository,
) : ViewModel() {

    data class InboxUiState(
        val conversations: List<WhatsAppConversation> = emptyList(),
        val loading: Boolean = true,
        val error: String? = null,
    )

    data class ThreadUiState(
        val conversation: WhatsAppConversation? = null,
        val messages: List<WhatsAppMessage> = emptyList(),
        val loading: Boolean = false,
        val sending: Boolean = false,
        val error: String? = null,
        val templates: List<WhatsAppTemplate> = emptyList(),
    )

    private val _uiState = MutableStateFlow(InboxUiState())
    val uiState: StateFlow<InboxUiState> = _uiState.asStateFlow()

    private val _threadState = MutableStateFlow(ThreadUiState())
    val threadState: StateFlow<ThreadUiState> = _threadState.asStateFlow()

    init {
        load()
    }

    /** Loads the conversation list into [uiState]; surfaces failures as [InboxUiState.error]. */
    fun load() {
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            try {
                val conversations = repository.conversations()
                _uiState.update { it.copy(conversations = conversations, loading = false, error = null) }
            } catch (e: Exception) {
                _uiState.update { it.copy(loading = false, error = e.message ?: "Could not load conversations") }
            }
        }
    }

    /** Manual retry / pull-to-refresh — same path as [load]. */
    fun refresh() = load()

    /** Opens a conversation: loads its messages plus the template catalog. */
    fun openThread(conversation: WhatsAppConversation) {
        _threadState.update { it.copy(conversation = conversation, loading = true, error = null) }
        viewModelScope.launch {
            try {
                val messages = repository.messages(conversation.id)
                val templates = repository.templates()
                _threadState.update {
                    it.copy(
                        messages = messages,
                        templates = templates,
                        loading = false,
                        error = null,
                    )
                }
            } catch (e: Exception) {
                _threadState.update {
                    it.copy(loading = false, error = e.message ?: "Could not load the conversation")
                }
            }
        }
    }

    /** Closes the thread and returns to the conversation list. */
    fun closeThread() {
        _threadState.value = ThreadUiState()
    }

    /**
     * Sends [text] to the selected conversation's contact. On success the
     * outbound message is appended locally so the thread updates immediately;
     * on failure the error is surfaced and the composer keeps its text.
     */
    fun sendMessage(text: String) {
        val conversation = _threadState.value.conversation ?: return
        val contactJid = conversation.contactJid ?: run {
            _threadState.update { it.copy(error = "This conversation has no contact to message") }
            return
        }
        val trimmed = text.trim()
        if (trimmed.isEmpty() || _threadState.value.sending) return

        viewModelScope.launch {
            _threadState.update { it.copy(sending = true, error = null) }
            try {
                val response = repository.send(contactJid, trimmed)
                val serverError = response.error
                if (serverError != null) {
                    _threadState.update {
                        it.copy(
                            sending = false,
                            error = serverError.message ?: "Send failed (${serverError.code})",
                        )
                    }
                    return@launch
                }
                val now = Instant.now().toString()
                val outbound = WhatsAppMessage(
                    id = "local-$now",
                    conversationId = conversation.id,
                    direction = "outbound",
                    type = "text",
                    body = trimmed,
                    status = "sent",
                    sentAt = now,
                    createdAt = now,
                )
                _threadState.update {
                    it.copy(messages = it.messages + outbound, sending = false, error = null)
                }
            } catch (e: Exception) {
                _threadState.update {
                    it.copy(sending = false, error = e.message ?: "Could not send the message")
                }
            }
        }
    }
}
