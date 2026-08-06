package com.opentelecrm.feature.inbox

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import org.unifiedpush.android.connector.FailedReason
import org.unifiedpush.android.connector.MessagingReceiver
import org.unifiedpush.android.connector.data.PushEndpoint
import org.unifiedpush.android.connector.data.PushMessage
import kotlinx.serialization.json.jsonObject

/**
 * M4 push: receives messages from a UnifiedPush distributor (e.g. ntfy app).
 * Payload is JSON: {"type":"lead","leadId":"<uuid>"} — posts a heads-up
 * notification whose tap opens the lead via the opentelecrm:// deep link.
 */
class PushMessageReceiver : MessagingReceiver() {

    override fun onMessage(context: Context, message: PushMessage, instance: String) {
        try {
            val json = message.content?.decodeToString() ?: return
            Log.d("PushReceiver", "push: $json")
            val leadId = extractLeadId(json) ?: return
            postNotification(context, leadId)
        } catch (e: Exception) {
            Log.e("PushReceiver", "push handling failed", e)
        }
    }

    override fun onNewEndpoint(context: Context, endpoint: PushEndpoint, instance: String) {
        Log.d("PushReceiver", "new endpoint: ${endpoint.url}")
    }

    override fun onRegistrationFailed(context: Context, reason: FailedReason, instance: String) {
        Log.d("PushReceiver", "registration failed: $reason")
    }

    override fun onUnregistered(context: Context, instance: String) {
        Log.d("PushReceiver", "unregistered: $instance")
    }

    private fun extractLeadId(json: String): String? {
        if (json.isBlank()) return null
        return runCatching {
            val obj = kotlinx.serialization.json.Json.parseToJsonElement(json).jsonObject
            obj["leadId"]?.let { (it as? kotlinx.serialization.json.JsonPrimitive)?.content }
        }.getOrNull()
    }

    private fun postNotification(context: Context, leadId: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel("push", "CRM Alerts", NotificationManager.IMPORTANCE_HIGH),
        )
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse("opentelecrm://lead/$leadId"))
            .setClassName(context, "com.opentelecrm.app.MainActivity")
        val pi = PendingIntent.getActivity(
            context, leadId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, "push")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle("OpenTeleCRM")
            .setContentText("New lead update — tap to open")
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        nm.notify(leadId.hashCode(), notification)
    }
}
