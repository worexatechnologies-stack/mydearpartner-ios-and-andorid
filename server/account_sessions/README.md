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
   `LoginView` validates member ID/username, email or registered mobile plus password,
   and returns an SMS challenge. Adapt the complete backend's identifier and
   verified-mobile lookup to its existing account/profile models.
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

## Password followed by SMS OTP

Deploy these endpoints into the complete authentication backend before rolling out
the mobile update. This checkout is a partial backend; it must not replace the
existing production service. Run `python manage.py migrate account_sessions` to
apply `0003_userphone_otpchallenge`. Populate `UserPhone` only from existing,
verified account mobile numbers, or adapt `resolve_user_phone` to that model.
Accounts without a registered mobile cannot complete SMS login.

- `POST /auth/login/` takes `{ "identifier": "member ID, email or mobile", "password": "..." }`.
  It returns `{ "requires_otp": true, "challenge_id": "UUID", "phone_masked": "******3210" }`.
  Password validation never returns tokens or replaces an existing session.
- `POST /auth/login/verify/` takes `{ "challenge_id": "UUID", "otp": "123456" }`.
  Only successful verification issues `{ "access": "...", "refresh": "...", "user": { "id": "..." } }`.
- `POST /auth/login/resend-otp/` takes `{ "challenge_id": "UUID" }` and returns a
  replacement challenge in the same format as login. The previous code stops working.

Codes expire after five minutes and allow five incorrect attempts. Login and resend
share a 60-second per-account send cooldown; requests also use the IP login throttle.
Challenge verification and consumption serialize on the account row in PostgreSQL.
SQLite unit tests cover state changes, not concurrent PostgreSQL execution.
Only an explicit verified `UserPhone` record supplies the destination; a mobile
username or an arbitrary phone attribute does not establish verification. Changing
or revoking that record invalidates outstanding verification and resend requests.

Configure `SMS_PROVIDER=renflair`, `RENFLAIR_API_KEY`, `RENFLAIR_SENDER_ID` and
`RENFLAIR_DLT_TE_ID` in the backend environment using the provider's approved SMS
template. No provider key or OTP belongs in the mobile app. Missing provider
configuration returns a delivery error instead of pretending a code was sent.
For automated tests use `TESTING=true`; for local development use
`SMS_PROVIDER=mock`. Both store test messages in `account_sessions.sms.MOCK_SMS_OUTBOX`
without delivering SMS. Real provider delivery still needs verification in the
deployed environment. Audit any other token-issuing login routes in that service so
they cannot bypass the password-plus-OTP requirement.

### Local verification — 27 October 2026

- `npm run check` passed: TypeScript, ESLint (0 errors, 264 warnings), all 464
  mobile tests across 82 suites, and security-tool regression checks.
- With Python 3.12 and the pinned `server/requirements.txt` installed, all 64
  tests passed for `account_sessions safety payments memberships config`.
  `manage.py makemigrations --check --dry-run` reported no changes.
- OTP tests mock SMS delivery. They cover verified-phone enforcement, phone
  changes/revocation, expiry, attempt limits, replay, resend cooldown, delivery
  failure rollback, and session issuance only after verification.

Complete-backend integration, real provider delivery, PostgreSQL concurrency and
physical-device acceptance remain outstanding. No deployment was performed.
