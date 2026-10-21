# Encrypted message push contract

Foreground chat pushes restore the secure session, decrypt locally, and create
one local notification. Background alert pushes are displayed by the operating
system; the JS handler skips a duplicate local notification. Data-only pushes
use the JS handler when the operating system permits background execution.

Every FCM chat push must include string data values for:

| Field | Purpose |
| --- | --- |
| `kind` | `chat_message` |
| `message_id` | Idempotency key and local-notification ID |
| `conversation_id` | API fallback lookup |
| `sender_id`, `receiver_id` | Member/account IDs used for E2EE derivation |
| `sender_name` | Notification title |
| `encrypted_text` | Original `__E2EE__:` wire text |

The visible notification body must remain generic (`You have a new message 🔒`)
because Android renders it while the app is terminated. The encrypted text
must remain in `data.encrypted_text` only. Foreground JS replaces this generic
body with the in-app notification; the background handler avoids duplicates.

## iOS terminated-state requirement

iOS does not reliably launch React Native/headless JavaScript for a terminated
app in response to a data-only background push. Use a mutable APNs alert and
the included Notification Service Extension for terminated-state previews.

This project now includes `ChatNotificationExtension`, which derives the
current deterministic key from `sender_id` and `receiver_id`; it requires no
private key in the payload or shared storage. The backend must call the chat
sender with `platform="ios"` for an iOS device record. That produces an APNs
alert with `mutable-content: 1`, allowing the extension to decrypt into
`bestAttemptContent.body` while the app is terminated. On an actual malformed
or undecryptable message it leaves `🔒 You have a new message`.

Before distributing, enable the Push Notifications capability for
`org.reactjs.native.example.MyDearPartner` and its Notification Service
Extension in the Apple Developer portal/Xcode signing profile. Upload an APNs
authentication key to the Firebase project. Never place plaintext or private
keys in the push payload.

## Delivery and rollout

`backend_fcm_snippet.py` is a reference sender, not the deployed chat service.
Integrate it into the actual backend after message persistence, targeting the
recipient's registered device tokens. Send `notification` plus `data`, Android
priority `high`, channel `mdp_messages_v2`, and a 24-hour TTL. TTL zero discards
messages that cannot be delivered immediately; it does not improve reliability.
Log the FCM send result and remove invalid device tokens.

Do not register `ChatFirebaseMessagingService` alongside React Native Firebase
as a second messaging service: it bypasses account/mute checks and may compete
with the existing handler. System-rendered alerts provide background display.

Verify on two physical devices: foreground, background, swiped away, temporary
network loss/reconnection, and notification tap opening the correct thread.
Check the Chat Messages channel separately from Interests in Android settings.
The local reference and unit tests cannot establish production push delivery.

## Session replacement security event

See `server/account_sessions/README.md` for the implementation and production
integration requirements. Send `kind=session_replaced`, the OLD `session_id`
(`mdp_sid`), and an `event_id` only to that old session's registered FCM token.
The app treats the push as a hint, checks authenticated `/auth/session/`, and
clears the captured session only on HTTP 401 `code=session_replaced`. Delayed
pushes for another session cannot sign out a newer login. Do not call a global
logout endpoint from a revocation handler. Use the server's generic visible
security message so an OS-rendered delayed push does not assert the current
session is invalid. OS delivery is best effort; API enforcement is authoritative.
