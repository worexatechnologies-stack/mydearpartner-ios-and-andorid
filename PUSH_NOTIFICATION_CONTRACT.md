# Encrypted message push contract

The mobile client treats a chat push as a delivery signal, not a finished
notification. It restores the secure session, decrypts locally, then creates
one local notification.

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
app in response to a data-only background push. The current Xcode project has
no Notification Service Extension or App Group, so it cannot truthfully produce
a decrypted preview in that state yet.

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
