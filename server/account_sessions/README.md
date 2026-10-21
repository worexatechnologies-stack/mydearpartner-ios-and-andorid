# One active account session

This Django module is implemented and tested in the local partial service. It
has NOT been deployed to the production authentication/profile/chat backend.
Do not replace production settings or URLs with this partial service.

## Integration into the complete backend

1. Add `account_sessions` to installed apps and run its migrations on PostgreSQL.
   Session issuance and refresh serialize on the account row; SQLite tests do not
   establish concurrent PostgreSQL behavior.
2. Keep existing credential, OTP, age/eligibility and signup validation. After
   successful authentication, use `issue_session_tokens(user)` instead of every
   existing token issuer, including OTP, signup, social and web login. It returns
   access and refresh tokens carrying the same random `mdp_sid`. The local
   `LoginView` is a reference username/password adapter, not a replacement for
   production identifier/email/phone authentication.
3. Use `SingleSessionAuthentication` on every protected API and the provided
   `SessionRefreshView` on `/api/v1/auth/token/refresh/`. Do not leave alternate
   refresh/token-issuance routes or stateless authentication classes as bypasses.
   Add session status, device registration and logout routes from `urls.py` to the
   existing URL configuration; preserve the production login endpoint/response.
4. Enforce `require_current_session(user, token)` in the production WebSocket
   authentication and message authorization code, and close replaced-session
   sockets through the existing socket layer. That code is not in this checkout.
   Review web cookies/Django browser sessions too: JWT checks alone do not revoke
   an independent cookie session. Every client must use the same session policy.
5. Configure Firebase Admin Application Default Credentials on the server through
   a protected `GOOGLE_APPLICATION_CREDENTIALS` path or workload identity. Never
   put these credentials in mobile env files. Set `SESSION_REPLACED_NOTIFY` to
   `account_sessions.push.send_session_notice` (default in the local settings).
   The mobile client registers its token at `/auth/session/device/` only for
   session-aware JWTs. Tokens are indexed by account AND session; never broadcast
   this event to every device belonging to the account. Filter normal chat and
   interest push targets to the active session, and detach legacy device
   registrations on replacement; otherwise old devices could still receive
   notification previews. Preserve the old security-notice target until its
   replacement event is dispatched. Production chat/interest senders are absent
   from this checkout.
6. Schedule `python manage.py retry_session_notices` in the production worker.
   The retry command considers the last 24 hours and skips rows without a
   registered target so unsupported devices do not block the queue.
   Notice rows survive transport failure. Delivery is best effort, at least once;
   provider collapse IDs limit repeated tray notices. Provider success is not
   proof of device receipt. Notifications can be disabled or delayed by the OS.
7. Roll out server and mobile together. Previously issued tokens without
   `mdp_sid` are rejected and need sign-in again. Plan this deliberate re-login
   with web clients. An old app will receive a normal authentication failure;
   the upgraded app provides the explicit replacement message.

No real production keys, tokens, SSH trust settings or live users were changed.

## Behavior

A successful login replaces the account's active session ID in a database
transaction. Old access and refresh tokens return HTTP 401 with:

```json
{"code":"session_replaced","detail":"Your account was signed in on another device. You have been logged out."}
```

`GET /auth/session/` returns `{ "active": true }` only for the active session.
`POST /auth/session/device/` accepts `{ "token": "FCM token" }`; the server
obtains the session/account from the authenticated JWT, never from the body.
`POST /auth/logout/` conditionally deletes only that exact session.

The app polls session status every 30 seconds while active for JWTs carrying
`mdp_sid`, and checks when returning to the foreground. Push data contains
`kind=session_replaced`, `session_id=<OLD mdp_sid>`, `event_id=<outbox id>`.
A push is only a hint: the client verifies with the API before clearing tokens;
a stale push for a different session is ignored. Network errors do not sign out.
The visible OS notification asks the user to open the app and check their
session; the verified in-app notice says they were signed out. Offline devices
may display cached UI until they reconnect, but the server rejects their tokens.

Run the module tests using Python 3.10+ and the requirements in `server/`:

```sh
DJANGO_DEBUG=true python manage.py test account_sessions safety payments memberships config --noinput
```
