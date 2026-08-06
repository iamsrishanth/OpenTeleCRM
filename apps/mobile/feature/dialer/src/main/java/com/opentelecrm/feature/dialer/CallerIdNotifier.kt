package com.opentelecrm.feature.dialer

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.telephony.PhoneStateListener
import android.telephony.TelephonyManager
import com.opentelecrm.core.auth.SessionManager
import com.opentelecrm.core.model.CallerIdLead
import com.opentelecrm.core.network.api.OpenTeleCrmApi
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * M3 incoming-caller-ID notifier. Watches phone state and, when a call is RINGING
 * with a non-blank number, looks the number up via [OpenTeleCrmApi.callerId] and
 * posts a heads-up notification when it matches a known lead.
 *
 * Wire once at app startup (OpenTeleCRMApplication.onCreate → [register]).
 * Registration is a no-op until READ_PHONE_STATE is granted; every failure path is
 * silent so the listener can never crash the app.
 */
@Singleton
class CallerIdNotifier @Inject constructor(
    private val api: OpenTeleCrmApi,
    private val sessionManager: SessionManager,
    @ApplicationContext private val context: Context,
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var registered = false

    private val telephonyManager: TelephonyManager? =
        context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager

    @Suppress("DEPRECATION")
    private val phoneStateListener = object : PhoneStateListener() {
        override fun onCallStateChanged(state: Int, incomingNumber: String?) {
            if (state != TelephonyManager.CALL_STATE_RINGING) return
            val number = incomingNumber?.trim().orEmpty()
            if (number.isBlank()) return
            lookupAndNotify(number)
        }
    }

    /** Starts watching for incoming calls. Idempotent; no-op without READ_PHONE_STATE. */
    fun register() {
        if (registered) return
        val tm = telephonyManager ?: return
        if (!hasReadPhoneStatePermission()) return
        try {
            @Suppress("DEPRECATION")
            tm.listen(phoneStateListener, PhoneStateListener.LISTEN_CALL_STATE)
            registered = true
        } catch (_: SecurityException) {
            registered = false
        } catch (_: Exception) {
            registered = false
        }
    }

    /** Stops watching for incoming calls. Idempotent. */
    fun unregister() {
        if (!registered) return
        val tm = telephonyManager ?: return
        try {
            @Suppress("DEPRECATION")
            tm.listen(phoneStateListener, PhoneStateListener.LISTEN_NONE)
        } catch (_: Exception) {
            // Best effort.
        } finally {
            registered = false
        }
    }

    private fun hasReadPhoneStatePermission(): Boolean =
        context.checkSelfPermission(Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED

    private fun lookupAndNotify(number: String) {
        scope.launch {
            try {
                val eid = sessionManager.session.value?.enterpriseId ?: return@launch
                val response = api.callerId(eid, number)
                if (!response.found) return@launch
                val lead = response.lead ?: return@launch
                showCallerIdNotification(number, lead)
            } catch (_: Throwable) {
                // Lookup failures are silent by design — never crash, never spam.
            }
        }
    }

    private fun showCallerIdNotification(number: String, lead: CallerIdLead) {
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Caller ID", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "Incoming call lead match" },
        )
        val title = lead.name() ?: lead.identifier ?: number
        val tags = lead.tags.filter { it.isNotBlank() }
        val text = buildString {
            append("score ").append(lead.score ?: 0)
            if (tags.isNotEmpty()) {
                append(" · ").append(tags.joinToString(", "))
            }
        }
        val openAppIntent = Intent().setClassName(context, "com.opentelecrm.app.MainActivity")
        val contentIntent = PendingIntent.getActivity(
            context,
            REQUEST_CODE,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(Notification.BigTextStyle().bigText(text))
            .setCategory(Notification.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(contentIntent)
            .build()
        try {
            manager.notify(notificationIdFor(number), notification)
        } catch (_: Throwable) {
            // POST_NOTIFICATIONS missing (API 33+) or platform quirk — silent.
        }
    }

    private fun notificationIdFor(number: String): Int =
        2000 + (number.hashCode() and 0x7fff)

    companion object {
        private const val CHANNEL_ID = "callerid"
        private const val REQUEST_CODE = 3001
    }
}
