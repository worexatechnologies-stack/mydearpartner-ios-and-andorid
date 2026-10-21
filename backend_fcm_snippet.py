"""Reference FCM senders. Call these after the database transaction commits."""
import logging
from datetime import timedelta
from firebase_admin import messaging

logger = logging.getLogger(__name__)


def send_chat_push_notification(
    fcm_device_token,
    sender_name,
    encrypted_text,
    message_id,
    conversation_id,
    sender_id,
    receiver_id,
    platform="android",
):
    """Send the E2EE wire text and IDs needed for local decrypt-before-display."""
    if not fcm_device_token:
        return False
    try:
        data = {
            "kind": "chat_message",
            "message_id": str(message_id),
            "conversation_id": str(conversation_id),
            "sender_id": str(sender_id),
            "receiver_id": str(receiver_id),
            "sender_name": sender_name,
            "encrypted_text": encrypted_text,
        }
        # Android receives a visible alert plus data so background display does
        # not depend on headless JS. iOS needs a mutable APNs alert to
        # execute the Notification Service Extension while the app is closed.
        apns = None
        if platform.lower() == "ios":
            apns = messaging.APNSConfig(
                headers={"apns-push-type": "alert", "apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title="💬 MyDearPartner",
                            body="🔒 You have a new message",
                        ),
                        mutable_content=True,
                        sound="default",
                    )
                ),
            )
        response = messaging.send(
            messaging.Message(
                token=fcm_device_token,
                data=data,
                # A visible notification is required when Android has
                # terminated the app; data-only delivery depends on the JS
                # runtime being alive. The encrypted text remains data-only
                # and is never placed in this visible body.
                notification=messaging.Notification(
                    title=f"💬 {sender_name}",
                    body="You have a new message 🔒",
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                    ttl=timedelta(hours=24),  # retain while temporarily offline
                    notification=messaging.AndroidNotification(
                        channel_id="mdp_messages_v2",
                        priority="max",
                        default_sound=True,
                        default_vibrate_timings=True,
                    ),
                ),
                apns=apns,
            )
        )
        logger.info("Sent chat push %s", response)
        return True
    except Exception:
        logger.exception("Error sending chat push notification")
        return False


def send_interest_push_notification(
    fcm_device_token, sender_name, interest_id, platform="android"
):
    """Notify either platform after an interest is persisted."""
    if not fcm_device_token:
        return False
    try:
        apns = None
        if platform.lower() == "ios":
            # An iOS app that is closed cannot render an Android-style
            # data-only message. APNs must contain an alert for the system to
            # display the received-interest notification.
            apns = messaging.APNSConfig(
                headers={"apns-push-type": "alert", "apns-priority": "10"},
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title="❤️ New Interest",
                            body=f"{sender_name} sent you an interest!",
                        ),
                        sound="default",
                    )
                ),
            )
        response = messaging.send(
            messaging.Message(
                token=fcm_device_token,
                data={
                    "kind": "interest_received",
                    "interest_id": str(interest_id),
                    "sender_name": sender_name,
                },
                notification=messaging.Notification(
                    title="❤️ New Interest",
                    body=f"{sender_name} sent you an interest!",
                ),
                android=messaging.AndroidConfig(
                    priority="high",
                    ttl=timedelta(hours=24),  # retain while temporarily offline
                    notification=messaging.AndroidNotification(
                        channel_id="mdp_interests_v2",
                        priority="max",
                        default_sound=True,
                        default_vibrate_timings=True,
                    ),
                ),
                apns=apns,
            )
        )
        logger.info("Sent interest push %s", response)
        return True
    except Exception:
        logger.exception("Error sending interest push notification")
        return False
