package com.mydearpartner

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Native fallback for data-only FCM messages. React Native's headless JS is
 * not guaranteed to start after Android has been swiped away, so the native
 * service always posts a generic, privacy-safe notification for chat/interest
 * pushes. The JS handler still handles decryption and in-app previews when it
 * is running.
 */
class ChatFirebaseMessagingService : FirebaseMessagingService() {
  companion object {
    private const val CHANNEL_ID = "mdp_messages_v2"
    private const val INTEREST_CHANNEL_ID = "mdp_interests_v2"
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val data = message.data
    val kind = data["kind"]?.lowercase().orEmpty()
    val isInterest = kind.contains("interest") || kind.contains("like") || data.containsKey("interest_id") || data.containsKey("interestId")
    val isChat = kind.contains("message") || kind.contains("chat") || data.containsKey("conversation_id") ||
      data.containsKey("conversationId") || data.containsKey("chat_id") || data.containsKey("chatId") ||
      data.containsKey("message_id") || data.containsKey("messageId") || data.containsKey("message") ||
      data.containsKey("body") || data.containsKey("text")
    if (!isInterest && !isChat) return

    val sender = (data["sender_name"] ?: data["senderName"] ?: data["from_name"])?.takeIf { it.isNotBlank() } ?: "Someone"
    val title = if (isInterest) "❤️ New Interest" else "💬 $sender"
    val body = if (isInterest) "$sender sent you an interest!" else
      (data["notification_body"] ?: data["body"] ?: data["text"] ?: "You have a new message 🔒")
    val channelId = if (isInterest) INTEREST_CHANNEL_ID else CHANNEL_ID
    val notificationId = (data["message_id"] ?: data["interest_id"] ?: message.messageId ?: System.currentTimeMillis().toString()).hashCode()

    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelName = if (isInterest) "Interests & Matches" else "Chat Messages"
      manager.createNotificationChannel(
        NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH),
      )
    }

    val intent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("conversation_id", data["conversation_id"] ?: data["conversationId"] ?: data["chat_id"] ?: data["chatId"])
      putExtra("sender_id", data["sender_id"])
      putExtra("kind", data["kind"])
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      notificationId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(com.mydearpartner.R.drawable.ic_stat_notification)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .setVibrate(longArrayOf(0, 300, 500))
      .build()

    manager.notify(notificationId, notification)
  }
}
