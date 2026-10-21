# Matching, messaging, notification health, and tablet conversations

Implemented locally on 19 October 2026. No production service was changed and no live Gemini request was made.

## Resulting behavior

- Profile comparisons use actual supplied facts and identify missing information. Removed hash-generated Guna scores, fabricated horoscope strengths, fixed fallback compatibility percentages, and unsupported premium horoscope claims. The horoscope filter now means a member listed their star, not that a compatibility calculation was performed.
- Match Score and Profile Match Insights now open separate panels (see follow-up below). Optional Gemini insights require a deliberate request with disclosure of the fields shared. AI results, deterministic fallback, and unavailable services are labeled separately. A response from a previously viewed candidate cannot populate the new candidate's panel.
- The mobile app calls the authenticated matching endpoint. The backend validates the member session against Django and resolves the authorized candidate profile itself. Configure the server key and reverse proxy using `backend/README.md`. Adding the key without deploying/routing this service does not activate AI in the production mobile app.
- Outgoing chat messages show Sending, Sent, Delivered, Read, Not sent, or Status unknown. Sent requires a saved server message response; Delivered/Read require explicit server receipt fields. Removed inferred read ticks based on replies and double ticks based only on message IDs. Definitive failures have an explicit retry action and concurrent retries share a single send. Uncertain outcomes require refresh rather than automatic resend; the member can dismiss the local status after checking history. This does not delete a server message.
- Restored interrupted sends have unknown status. This app does not claim exactly-once delivery: the deployed chat backend still needs an idempotency key contract for automatic retry of uncertain sends.
- Notification health appears above the notification list. It reports permission, separate Android chat/interest channel settings, token availability, and the last backend-registration result. Reconnect and system-settings actions are available. It never exposes a token or equates local readiness with proven background delivery.
- The Conversations tab uses a list and selected-chat workspace when safe-area width is at least 900 points, or 1100 with large text. Rotation retains the selected conversation and switches to a single pane as space narrows. Phone navigation remains native. Only the selected, focused chat mounts the active conversation connection.

## Deployment dependencies

1. Add a real `GEMINI_API_KEY` and `MEMBER_API_BASE_URL` to the matching service environment. The example file contains no secret. Review the configured Gemini model against the provider/account before deployment.
2. Route `/api/v1/matches/` to the matching service while leaving existing Django member/chat routes intact. It is an additional service, not a replacement for production Django.
3. Verify Gemini success, missing-key fallback, invalid-session denial, and profile-access denial in staging using dedicated accounts.
4. Verify chat receipts against the deployed message API. Supported fields are boolean `is_read`/`is_delivered` or valid `read_at`/`delivered_at` timestamps. Without these, messages remain Sent. The server must produce and persist actual recipient acknowledgments before it can claim delivery/read.
5. Test physical Android/iOS notification delivery, notification reconnect, phone/tablet rotation, chat keyboard, and two-account send/retry behavior. Local tests do not establish these live outcomes.

## Validation

- Root `npm run check` passes: TypeScript, lint with zero errors, 58 suites / 278 tests, and security-tool regressions.
- Backend `npm test` passes: TypeScript build and 10 tests. Tests stub Gemini and the member API; they do not use real credentials or modify production accounts.
- Final Android `:app:assembleRelease :app:bundleRelease` succeeds. APK: `android/app/build/outputs/apk/release/app-release.apk`. AAB: `android/app/build/outputs/bundle/release/app-release.aab`.
- Logs: `/tmp/mdp-features-final-check.log`, `/tmp/mdp-features-backend-final.log`, `/tmp/mdp-feature-release-final.log`.
- Physical-device acceptance, live Gemini calls, production routing, and signed iOS distribution remain unverified.

## Photo fitting and AI availability follow-up

The profile carousel now fits complete photos using `contain`, sizes the frame from valid source dimensions within viewport limits, and gives every carousel page an explicit height. Name/location are below the photo rather than covering it. This avoids client-side face cropping and dark overlay text placement. Borders already embedded in an uploaded image cannot be removed by a resize-mode change.

The insights sheet has a bounded scroll area and checks `/matches/capabilities/` before offering an AI request. An undeployed service or missing configuration gets a neutral unavailable state plus a recheck action, while profile facts remain usable. Rate limits, expired sessions, and network failures have distinct messages. The backend availability endpoint returns only configuration metadata, never a credential or profile, and never calls Gemini.

Fresh production probes returned 404 for both GET and an unauthenticated empty JSON POST to `/api/v1/matches/compatibility/`. The latter would return 401 if the current matching route were reachable. SSH to the documented host fails with `Host key verification failed`, and there is no local `~/.ssh/config` alias to use instead. No host-key checks were disabled and no production configuration was changed. The operator must establish a verified host and deploy the matching route to restore live AI requests; the mobile availability state is not a deployment fix.

Reviewed deployment examples are in `backend/deploy/`; adapt them to the actual host or private Compose network. Do not replace the existing Django/Next.js proxy routes.

Follow-up validation: root checks pass (59 suites / 290 tests, TypeScript, zero lint errors, security regressions); backend build and 11 tests pass. Logs: `/tmp/mdp-photo-ai-final-check.log`, `/tmp/mdp-photo-ai-backend-check.log`. Android APK and AAB builds succeeded; APK signature verification passed. Build log: `/tmp/mdp-photo-ai-release-build.log`. Physical-device visual acceptance and live AI success remain unverified.


## Separate match score and conversation insights

The Match Score Details button opens a dedicated score panel: reported percentage, known profile facts, missing information, and an explicit note that score weights/calculation details are unavailable. It does not query the AI service or present its controls. The Profile Match Insights button opens conversation ideas and optional AI suggestions, without repeating the reported percentage or the full comparison table. Its share action shares conversation ideas.

Root validation passes: 60 suites / 293 tests, TypeScript, lint with zero errors, and security-tool regressions. Regression tests verify the panels differ and the score panel makes no matching/AI requests. Log: `/tmp/mdp-distinct-match-panels-check.log`. Android package build: `/tmp/mdp-distinct-match-panels-build.log`.

## Shared match reasons and message history

“Why you matched” now lists only supplied attributes shared by both profiles, with case/whitespace normalization and the existing Bengaluru/Bangalore alias handling. Candidate-only education, profession, or diet no longer appears as a reason. Unknown and placeholder values are excluded, and the card stays hidden if there are no shared reasons. The reported server match percentage is unchanged.

The chat API now exposes one decrypted message page plus its server-provided `next` link. “Load more history” follows that link, merges by message ID, retains current recent messages, and keeps retryable failures on the same cursor. Repeated links stop pagination instead of forming a loop. Links must use the configured HTTPS API origin and the same conversation/partner message path; credentials are not forwarded to external or different-conversation links.

Latest-page refreshes preserve the history cursor after earlier pages have been loaded. Older pages never replace the conversation preview with an older message. The list maintains visible content and suppresses scroll-to-bottom while reading history; arriving messages scroll only when the reader is near the bottom. Parallel history requests are suppressed, and history controls show loading/retry states.

Backend requirement: responses must provide a standard `next` link (DRF results/next or messages/next envelopes). Plain array responses still work and do not produce guessed page requests. If the deployed backend truncates history without pagination metadata, that backend contract must be extended separately; no authenticated production history request was made here.

Validation: root checks pass, 61 suites / 305 tests, TypeScript, lint with zero errors, and security-tool regressions. Tests cover shared/missing/placeholder profile facts, validated pagination links and fallback routes, duplicate merging, retries, concurrency, cursor loops, and preserving reading position. Logs: `/tmp/mdp-match-history-check.log` and `/tmp/mdp-match-history-build.log`. Physical-device scrolling acceptance remains pending.

The shared-reasons/history Android APK and AAB builds succeeded; APK signature verification passed. Current packages are in `android/app/build/outputs/apk/release/app-release.apk` and `android/app/build/outputs/bundle/release/app-release.aab`.

## Follow-up: analytics transport and explicit partner preferences

- Installed matching RN Firebase Analytics 26.3.3 and used the modular API;
  installed iOS pods without advertising ID support. Removed event parameter
  console output. First-open storage is marked only after a successful SDK call;
  custom event uses `app_first_open` rather than Firebase's reserved auto-event.
- Gateway comparisons now evaluate supported explicit preferences in both
  directions, sourced only from authenticated upstream profiles. Missing facts
  remain unknown; caller-injected preferences are ignored. Existing production
  discovery scores/ranking are unchanged. See backend README for supported fields.
- Validation: root check passes 62 suites / 307 tests; backend 13 tests pass.
- Not completed: replacement private-key chat protocol requires the production
  chat backend and web client, absent here. Duplicate-free retries require server
  idempotency support; automatic retries of uncertain sends remain disabled.
  Production matching deployment remains blocked by unverified SSH host identity
  and unknown deployment path. No server trust settings were changed.
- Optional chat media/search/edit/delete were not added in this reliability fix.

- Android release APK and AAB build succeeded after analytics integration. iOS pods installed; an iOS archive and live analytics delivery were not verified.


## Single active account session (local implementation)

- Added Django `account_sessions`: database session ID replacement after verified
  login, session-aware access authentication, refresh checking under the same
  account lock, conditional logout, and status/device registration endpoints.
- Targeted Firebase Admin notices and durable retry outbox; credentials remain
  server-only via ADC. `retry_session_notices` processes registered targets from
  the last 24 hours. Provider delivery remains best effort.
- Mobile verifies replacement pushes with the API, ignores stale session IDs,
  clears only matching captured credentials/identity, and never calls server
  logout from the revocation handler. Background notices persist for foreground
  display. Session-aware tokens are checked every 30 seconds while active and on
  returning to foreground. Offline errors do not trigger logout.
- Validation: 64 Jest suites / 315 tests, TypeScript, lint with no errors,
  security regression checks, 36 Django tests (including existing modules),
  release APK/AAB build and APK signature verification passed. Provider calls
  are mocked in tests; no production credentials or real users were used.
- NOT deployed or active in production. Full backend integration is required for
  all issuers (including web/OTP/signup), every API authentication override,
  WebSocket authorization, browser cookie sessions, and normal push targeting.
  See `server/account_sessions/README.md`. No production SSH trust was changed.

## App reliability and status UI follow-up

- Block checks now return unknown for outages, absent endpoints and malformed
  responses instead of reporting a confirmed non-block. Chat shows a connection
  check/retry banner and discards stale check responses when the partner changes.
  Confirmed block behavior remains; the backend must authorize every send.
- Notification health now offers a targeted next step for disabled permission,
  disabled/missing chat channels, missing registration and unavailable settings.
  A disabled chat channel has a button opening that channel's device settings.
  Ready local settings explicitly request a real delivery test, not a success claim.
- Match insights adds an availability badge and keeps profile conversation ideas
  usable when AI is absent. Provider disclosure appears with the available AI action.
- Unconfirmed messages explain why refreshing is safer than resending; the refresh
  action remains usable even when sending is locked. Failed and unconfirmed labels
  no longer advertise tapping on noninteractive text.
- Validation: root check passed TypeScript, lint (0 errors), 66 suites / 328 tests,
  and security-tool regression checks. Device visual testing was not completed.
- Partner preference editing, chat media, saved search alerts and chat search were
  not implemented in this pass. A preference-save endpoint was not confirmed in
  available backend routes. Production AI/single-session integration and encryption
  protocol changes remain separate backend work. Production patch remains undeployed.

- Release APK and AAB build succeeded; APK signature verification passed after this app update.

## Follow-up to chat screenshot: remove misleading connection warning

The prior connection-check/retry banner confused optional block-status lookup
availability with chat transport health. It appeared even when messages were
successfully sent. Removed that banner and kept unknown as a distinct internal
state. Optional lookup failure does not imply the recipient is unblocked and
cannot override server authorization. An explicit HTTP 403 `blocked_by_user`
denial disables replies immediately and invalidates pending older checks.
Regression tests cover the screenshot scenario and a late check arriving after
an authoritative block denial. No backend API, notification sender or actual
message delivery behavior was changed by this fix.

Validation for the screenshot fix: TypeScript, lint (no errors), 66 suites / 329
tests and security-tool regressions passed. The unknown-lookup banner removal
supersedes the earlier connection-status banner entry above.

Screenshot fix release APK/AAB build succeeded; APK signature verified. Physical device visual verification remains pending.
