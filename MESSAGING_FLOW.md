# How Messaging Works End-to-End
## My Dear Partner — Message Delivery, E2EE & Fetching (Frontend → Backend → DB)

**Goal of this doc:** Explain in plain, step-by-step language exactly how a chat message travels from a member's screen all the way into the database, how the other member receives it, and how old messages are fetched back. No jargon hidden — every step maps to a real file.

**Two delivery highways (the key idea):**
1. **WebSocket (real-time)** — for "instant" messages & typing/read indicators while the chat is open.
2. **REST/HTTP (fetch + fallback)** — for loading history and for sending when the socket is down.

Both write to the **same database**, and every incoming message is also turned into a **notification + optional push**.

---

## Part A — Where a message "lives" (the database)

Everything is stored in PostgreSQL in these tables (`backend/apps/core/models.py`, `backend/apps/core/message_service.py`):

| Table | What it stores |
| :-- | :-- |
| `ChatConversation` | One stable row per two-member pair (`member_one`/`member_two` + name snapshots). Exactly one conversation between any two members. |
| `ChatConversationParticipant` | One row per member in the conversation (so we know who belongs). |
| `ChatMessage` | One row per message: `conversation`, `sender`/`receiver` (id + name snapshots), `text` (the **encrypted ciphertext**, see below), `is_read`, deletion fields, `message_type`. |
| `ChatMessageUserVisibility` | Per-user "**delete for me**" hiding (a message hidden for one user stays visible to the other). |
| `Notification` | A single "New message from X" bell alert (deduplicated per conversation). |

> **Important:** the *text* you store is **NOT the plain words**. The frontend encrypts each message before it ever reaches the backend (that is the **E2EE**). The backend only ever sees/stores the ciphertext, plus keeps the chat public key so legitimate clients can decrypt. Message delivery works end-to-end while content stays private.

---

## Part B — Sending a message (step by step)

**1. You type & hit Enter** (`frontend/legacy/pages/MessagesPage.tsx` → `handleSend`).
- It takes the draft, trims it, and **bumps** a temporary "pending" bubble into the chat immediately (**optimistic UI**) so it feels instant.

**2. It gets encrypted in YOUR browser** (`frontend/legacy/utils/crypto.ts`).
- Uses Web Crypto (ECDH P-256 shared key when both sides' keys are known, otherwise a PBKDF2 fallback key seeded from the two user ids).
- Output: `__E2EE__:{"iv":"...","ct":"..."}` — base64 **ciphertext**. This is what travels.

**3. Choose the delivery route** (the page checks `connected`):
- **If the chat WebSocket is open** → `sendSocket({ text: <cipher> })` sends a JSON frame over the socket.
- **If not connected** (or send fails) → `sendViaHttp` → REST `POST /conversations/<userId>/messages/` through the Next.js proxy.
- Either way, the **same encrypted text** reaches Django.

**4. WebSocket leg (real-time path)**
- Connection opens via `useChatSocket` (`frontend/hooks/use-chat-socket.ts`):
  - `new WebSocket(`${WS_BASE}/ws/chat/${partnerId}/`, ['access_token', accessToken])`
  - The second array item `['access_token', <JWT>]` is the **subprotocol auth** convention.
- Nginx → Daphne → `backend/config/routing.py` (`ProtocolTypeRouter`) → `JwtAuthMiddleware` (reads JWT from the subprotocol) → `ChatConsumer` (`backend/apps/core/consumers.py`).
- `ChatConsumer.connect` **validates** and returns a close-code if something's wrong: 4001 not logged-in member · 4002 self-message · 4003 partner gone · 4004 no chat permission · 4005 no mutual interest · 4006 blocked.
- On success it joins the **"room"** = `chat_{userA}_{userB}` (sorted user ids). Both people share this room.

**5. The consumer writes to the DB and broadcasts**
- On a text frame, `_create_message_if_allowed(text)`:
  - Re-runs entitlement checks (can message / mutual interest / not blocked / partner visible).
  - Calls `create_message(...)` in `message_service.py` → `get_or_create_conversation(...)` (with a DB lock for concurrency) → inserts the `ChatMessage` row. **This is the database write.**
  - Calls `notify_chat_message(...)` → upserts one `CHAT_MESSAGE` notification and, after commit, publishes it to a Redis group + queues **Web Push** (VAPID/FCM).
- Then `channel_layer.group_send(room, {type:'chat.message', message})` **broadcasts the saved message to every open socket** in that two-person room — including the sender's other tab and the receiver.

**6. The receiver's screen shows it live**
- Their `socket.onmessage` → `handleSocketMessage(data)` merges the message into the thread, decrypts it with `smartDecryptText`, and displays it. If the conversation isn't open, the unread badge / bell updates.
---

## Part C — How fetching (loading) history works

Three loading states:

1. **Conversation list (sidebar)** — `GET /conversations/` (via `frontend/legacy/services/dataService.ts` → `fetchApi` → Next.js proxy → `ConversationListView`).
   - Backend helper `conversation_summary_rows` returns it in effectively **constant queries**: latest message preview + per-conversation unread count + partner profile, paginated (50) with an `X-Has-More` header.

2. **Message thread history** — `GET /conversations/<userId>/messages/?cursor=…&page_size=20` (`getMessages` → `MessageHistoryView`).
   - Returns messages that aren't hidden for you, newest supported via cursor. Older messages load as you scroll up.

3. **Mark-as-read** — `POST /conversations/<userId>/mark-read/` flips `is_read` on Partner→you rows; the socket also broadcasts `read_receipt` so the sender's UI shows double-ticks live.

**REST send (socket is down)** works through DRF `SendMessageView` (or legacy `old_views.py`): authenticate JWT → the same receiver/entitlement checks → `create_message` → DB write → also `group_send` `chat.message` so open sockets still get the real-time update.

---

## Part D — deleting & hiding
- **Delete for me** → `ChatMessageUserVisibility` with `hidden=True` (only for me).
- **Delete for everyone** → only the sender → sets `deleted_for_everyone` (both sides see "message deleted").
- Sent over the socket as `chat.message_deleted` or over REST `DELETE /messages/<id>/?action=…`.

---

## Part E — What about the notification bell & push?
`backend/apps/core/api_utils.py`:
- `notify_chat_message()` keeps **ONE** unread `CHAT_MESSAGE` notification per sender instead of one per message (so 10 quick messages = 1 bell entry, bumped to top).
- On commit → `broadcast_notification()` → Redis `group_send` to both legacy (`notifications_{id}`) and unified (`user_{id}`) groups → the `NotificationConsumer` (`backend/apps/notifications/consumers.py`) forwards it live.
- Also `queue_notification_push()` → Web Push / FCM (queued through Celery), so it arrives even while offline.
- Opening/reading the conversation clears that CHAT_MESSAGE alert.
---

## The full one-paragraph story
You type → your browser **encrypts** the text (E2EE) → it's sent either **over the WebSocket** (`ws/chat/<partnerId>/`) or **via HTTP POST** when disconnected → Django's `ChatConsumer` / `SendMessageView` **validates** you (member, mutual interest, not blocked, plan) → **writes** the ciphertext row into PostgreSQL (`ChatMessage` + conversation) → **broadcasts** it to the two-person Redis room so both screens update instantly → creates a **notification + push** for the receiver → the receiver's browser **decrypts** and shows it. History (conversation list + thread) is loaded separately **over HTTP** with pagination and read/delete sync.

---

## Quick reference — key files
| Layer | File | Role |
| :-- | :-- | :-- |
| Frontend send UI | `frontend/legacy/pages/MessagesPage.tsx` | handleSend, optimistic UI, socket+REST fallback |
| Frontend E2EE | `frontend/legacy/utils/crypto.ts` | encrypt/decrypt, key derive |
| Frontend socket | `frontend/hooks/use-chat-socket.ts` | WS connect/auth(token), reconnect |
| Frontend data | `frontend/legacy/services/dataService.ts` | getConversations/getMessages/sendMessage/markRead |
| Proxy | `frontend/app/api/proxy/[...path]` + `lib/django-proxy.ts` | bearer + cookies + protected paths |
| WS auth | `backend/config/routing.py`, `backend/apps/notifications/middleware.py` | subprotocol/query JWT |
| Chat consumer | `backend/apps/core/consumers.py` | receive, validate, room broadcast |
| Message service | `backend/apps/core/message_service.py` | conversation get/create, create_message |
| Domain models | `backend/apps/core/models.py` | Conversation/Message/Visibility/Notification |
| Notify/push | `backend/apps/core/api_utils.py`, `backend/apps/notifications/*` | bell dedupe, Redis groups, web push |

---

## Part F — Why the "Encrypted 🔒 vs all messages" behavior depends on HTTPS

**Short answer:** encryption/decryption uses the **Web Crypto API (`window.crypto.subtle`)**. Browsers only provide it in a **secure context** — HTTPS or `localhost`. On plain HTTP the crypto functions don't exist, so reading ciphertext fails and shows `🔒 Encrypted message`, while HTTPS re-derives the same key and decrypts everything.

**What the code does:**

- `frontend/legacy/utils/crypto.ts` → `isWebCryptoSupported()` checks `window.isSecureContext && window.crypto?.subtle`.
- Send (`MessagesPage.handleSend`): `deriveFallbackKey([userA, userB].sort().join('_'))` (PBKDF2, fixed salt) then `encryptMessage()`. On failure **the catch sends plaintext** (⚠️ on HTTP new messages are stored unencrypted).
- Read (`smartDecryptText`): ciphertext recognized → tries `crypto.subtle.decrypt` → on HTTP it throws → returns `'🔒 Encrypted message'`.

| Context | Sending | Reading old E2EE messages |
| :-- | :-- | :-- |
| HTTPS / localhost | `crypto.subtle` exists → encrypted properly | Derives the same deterministic key → **all messages readable** |
| Plain HTTP | `crypto.subtle` undefined → **plaintext stored** | Cannot decrypt → shows **"🔒 Encrypted message"** |

**Because the active key is deterministic (derived from user IDs), the same messages decrypt on any device/browser *as long as HTTPS is used*.** The ECDH keypair + `chat_public_key` exist as the stronger per-device path, but the current chat UI decrypts without them.

**Recommendation:** keep the whole app behind HTTPS (Nginx `NGINX_TLS_MODE=strict`, `SECURE_SSL_REDIRECT=True`) and consider refusing to send (instead of plaintext fallback) when `isWebCryptoSupported()` is false.

---
*End of messaging-flow explanation.*

this message work in web