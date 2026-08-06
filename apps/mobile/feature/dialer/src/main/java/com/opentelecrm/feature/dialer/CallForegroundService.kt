package com.opentelecrm.feature.dialer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import java.time.Instant
import java.time.OffsetDateTime
import java.time.format.DateTimeParseException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * M3 active-call foreground service (`foregroundServiceType="phoneCall"`, already
 * declared in the app manifest). It does NOT place calls — it only renders
 * [CallSession] state: an ongoing "Call in progress" notification whose text shows
 * the elapsed seconds, plus an "End" action that marks the call ended in
 * [CallSession] (endedAt = now) and stops the service.
 *
 * Start via [CallForegroundService.start], stop via [CallForegroundService.stop].
 * Any failure inside the service (bad state, unparseable timestamps, platform
 * quirk) results in [stopSelf] — the service must never crash the app.
 */
class CallForegroundService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private var tickerJob: Job? = null

    private var leadPhone: String = ""
    private var leadName: String = ""

    /** Local receiver for the notification's "End" action. */
    private val endCallReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != ACTION_END_CALL) return
            try {
                CallSession.update { it.copy(endedAt = Instant.now().toString()) }
            } catch (_: Throwable) {
                // Never let the receiver crash the process.
            }
            context.stopService(Intent(context, CallForegroundService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        registerReceiver(endCallReceiver, IntentFilter(ACTION_END_CALL))
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            leadPhone = intent?.getStringExtra(EXTRA_PHONE) ?: leadPhone
            leadName = intent?.getStringExtra(EXTRA_NAME) ?: leadName

            startForegroundCompat(buildNotification(null))

            tickerJob?.cancel()
            tickerJob = serviceScope.launch {
                try {
                    CallSession.state.collect { state ->
                        // No live call — nothing to render, drop the indicator.
                        if (!state.isActive()) {
                            stopSelf()
                            return@collect
                        }
                        // Ensure a start time exists so elapsed can be computed;
                        // the re-emission from our own update re-enters this lambda.
                        if (state.startedAt == null) {
                            CallSession.update { it.copy(startedAt = Instant.now().toString()) }
                            return@collect
                        }
                        val startedMillis = parseIsoMillis(state.startedAt)
                        // Tick every second while this exact call stays active.
                        while (isActive) {
                            val current = CallSession.state.value
                            if (!current.isActive()) {
                                stopSelf()
                                return@collect
                            }
                            if (current.startedAt != state.startedAt) {
                                // New start time (e.g. server timestamp landed) —
                                // let the pending emission re-render.
                                return@collect
                            }
                            val elapsed = startedMillis?.let {
                                ((System.currentTimeMillis() - it) / 1000L).coerceAtLeast(0L)
                            }
                            notificationManager?.notify(NOTIF_ID, buildNotification(elapsed))
                            delay(1000L)
                        }
                    }
                } catch (_: Throwable) {
                    stopSelf()
                }
            }
        } catch (_: Throwable) {
            stopSelf()
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        tickerJob?.cancel()
        serviceScope.cancel()
        try {
            unregisterReceiver(endCallReceiver)
        } catch (_: Throwable) {
            // Already unregistered.
        }
        stopForegroundCompat()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun createNotificationChannel() {
        val manager = getSystemService(NotificationManager::class.java) ?: return
        val channel = NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_LOW).apply {
            setSound(null, null)
            enableVibration(false)
            description = "Active call indicator"
        }
        manager.createNotificationChannel(channel)
    }

    private fun buildNotification(elapsedSec: Long?): Notification {
        val openAppIntent = Intent().setClassName(this, "com.opentelecrm.app.MainActivity")
        val contentIntent = PendingIntent.getActivity(
            this,
            REQUEST_OPEN_APP,
            openAppIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val endCallIntent = Intent(ACTION_END_CALL)
        val endCallPendingIntent = PendingIntent.getBroadcast(
            this,
            REQUEST_END_CALL,
            endCallIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val text = buildString {
            append(leadName.ifBlank { "Call" })
            append(" · ")
            append(leadPhone.ifBlank { "—" })
            if (elapsedSec != null && elapsedSec > 0) {
                append(" · ")
                append(formatElapsed(elapsedSec))
            }
        }
        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_call)
            .setContentTitle("Call in progress")
            .setContentText(text)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_CALL)
            .setContentIntent(contentIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "End", endCallPendingIntent)
            .build()
    }

    private fun formatElapsed(sec: Long): String {
        val h = sec / 3600
        val m = (sec % 3600) / 60
        val s = sec % 60
        return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
    }

    /** ISO-8601 → epoch millis. Handles `Z` and numeric offsets; null when unparseable. */
    private fun parseIsoMillis(iso: String?): Long? {
        if (iso.isNullOrBlank()) return null
        return try {
            OffsetDateTime.parse(iso).toInstant().toEpochMilli()
        } catch (_: DateTimeParseException) {
            try {
                Instant.parse(iso).toEpochMilli()
            } catch (_: DateTimeParseException) {
                null
            }
        }
    }

    private fun startForegroundCompat(notification: Notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL)
        } else {
            @Suppress("DEPRECATION")
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private val notificationManager: NotificationManager?
        get() = getSystemService(NotificationManager::class.java)

    companion object {
        private const val CHANNEL_ID = "calls"
        private const val NOTIF_ID = 1001
        private const val REQUEST_OPEN_APP = 1002
        private const val REQUEST_END_CALL = 1003
        private const val ACTION_END_CALL = "com.opentelecrm.feature.dialer.action.END_CALL"
        private const val EXTRA_PHONE = "extra_lead_phone"
        private const val EXTRA_NAME = "extra_lead_name"
        private const val EXTRA_CALL_ID = "extra_call_id"

        /** Starts the active-call foreground service. Safe to call from any thread. */
        fun start(context: Context, leadPhone: String, leadName: String, callId: String) {
            val intent = Intent(context, CallForegroundService::class.java)
                .putExtra(EXTRA_PHONE, leadPhone)
                .putExtra(EXTRA_NAME, leadName)
                .putExtra(EXTRA_CALL_ID, callId)
            context.startForegroundService(intent)
        }

        /** Stops the active-call foreground service (if running). */
        fun stop(context: Context) {
            context.stopService(Intent(context, CallForegroundService::class.java))
        }
    }
}
