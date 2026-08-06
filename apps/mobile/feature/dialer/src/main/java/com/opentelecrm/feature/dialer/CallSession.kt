package com.opentelecrm.feature.dialer

import com.opentelecrm.core.model.DialerCandidate
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/**
 * Snapshot of the current (or most recent) dialer call session.
 *
 * @param candidate the candidate the call was placed to (kept so the UI can
 *   render phone/score while the call is live).
 * @param activeCallId the call row id (`DialResponse.id`, falling back to the
 *   provider `callId`) used for polling `GET /calls/{id}`.
 * @param callStatus last known server status (e.g. "queued", "running", "ended").
 * @param startedAt/endedAt ISO-8601 timestamps from the call record.
 * @param leadId the dialed lead.
 */
data class CallState(
    val candidate: DialerCandidate? = null,
    val activeCallId: String? = null,
    val callStatus: String? = null,
    val startedAt: String? = null,
    val endedAt: String? = null,
    val leadId: String? = null,
) {
    /** A call is "live" while it has an id and has not ended yet. */
    fun isActive(): Boolean = activeCallId != null && endedAt == null
}

/**
 * Process-wide, singleton call-session store shared between the dialer UI
 * (DialerViewModel) and the sibling-owned [CallForegroundService].
 *
 * CONTRACT FOR THE CallForegroundService OWNER:
 *  - Read the live session via [state] (e.g. `CallSession.state.value.activeCallId`)
 *    to know which call a notification/FGS belongs to.
 *  - Mutate it with [update] (e.g. mark `callStatus = "ringing"` when the
 *    provider reports an inbound/outbound event, set `startedAt`/`endedAt`
 *    when the FGS observes them).
 *  - Call [reset] when a call is fully finished and disposition was saved
 *    (the ViewModel also calls it; calling it twice is harmless).
 *  - Never replace this object — it is a singleton `object`; the UI collects
 *    [state] and recomposes on every change.
 */
object CallSession {

    private val _state = MutableStateFlow(CallState())

    /** Observable current session; `CallState()` (all null) when idle. */
    val state: StateFlow<CallState> = _state.asStateFlow()

    /** Applies a transform to the current session. */
    fun update(transform: (CallState) -> CallState) {
        _state.update(transform)
    }

    /** Clears the session back to idle. */
    fun reset() {
        _state.value = CallState()
    }
}
