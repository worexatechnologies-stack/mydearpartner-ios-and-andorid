# Production QA report — 2026-10-05

## Decision

**NOT PRODUCTION READY.** The fixes below improve local correctness, but predictable chat encryption keys remain a P0 security defect. Full authenticated iOS/Android journeys, remote push delivery, payments, and release artifacts have not passed end-to-end verification. A successful unit test or debug build is not a production workflow pass.

The workspace already contained extensive modified and untracked implementation files before this audit. This report describes this audit's changes and evidence; it does not attribute the existing implementation to this audit. The earlier `APP_AUDIT_REPORT.md` is preserved.

## Issues found and dispositions

26 concrete findings: **21 fixed and regression-verified**, **1 implemented with runtime verification pending**, **4 unresolved/partially mitigated**. Fixed breakdown: P0: 0; P1: 11; P2: 10; P3: 0. Counts group related symptoms under their root cause. Unexecuted scenarios are verification gaps, not invented bugs.

| # | Priority | Failure and root cause | Change / verification | Disposition |
|---|---|---|---|---|
| 1 | P1 | Delayed login/signup/profile responses could revive a logged-out session | Session revision guards across asynchronous boundaries; cancellation tests | Fixed |
| 2 | P1 | Native Keychain deletion failure could restore credentials after logout | Persist logout intent, honor it on reads, serialize token writes; failure regression tests | Fixed |
| 3 | P1 | Delayed identity writes could race logout cleanup | Serialize identity writes/deletes with session storage; ordering tests | Fixed |
| 4 | P1 | Old API replies/401 retries could cross into a new account | Verify captured session before accepting replies/retrying, including uploads; delayed 200/401 tests | Fixed |
| 5 | P1 | Private notification previews could decrypt with stale persisted identity | Require active crypto gate, validate receiver, recheck session after decrypt; logout/receiver tests | Fixed |
| 6 | P1 | Interest write fallback could replay a successful-but-timed-out mutation | Restrict identifier fallback to validation errors and route fallback to 404/405; transport tests | Fixed |
| 7 | P1 | Chat read-receipt fallback retried unrelated transport/server failures | Restrict alternate route writes to missing routes; service tests | Fixed |
| 8 | P2 | Invalid conversation/message/interest payload rows could crash consumers | Validate rows, identifiers and timestamps; malformed payload tests | Fixed |
| 9 | P2 | Unexpected profile scalar types leaked into UI and duplicate discovery rows | Normalize strings/numbers/interests and deduplicate IDs; normalization tests | Fixed |
| 10 | P2 | Concurrent chat loads could both wait for crypto then start duplicate work | Acquire single-flight lock before crypto await; concurrent-load regression | Fixed |
| 11 | P2 | Profile updates left premium/completion metadata stale | Rebuild derived user metadata consistently; context tests | Fixed |
| 12 | P2 | API/upload failures exposed internal stack/exception details | Sanitize hard and soft error responses; API/upload regressions | Fixed |
| 13 | P2 | Splash timers/animations continued after unmount | Cancel navigation timer, dot loop and shared animations; unmount regression | Fixed |
| 14 | P2 | Eligibility default year disagreed with default age and its missing-backend test was skipped | Align date selection and accessible action; actual 404 failure test enabled | Fixed |
| 15 | P2 | Connection error icon depended on an unbundled Feather font | Use bundled Ionicons; simulator screenshot verifies icon | Fixed |
| 16 | P2 | Three baseline Jest suites failed on real dependency ESM parsing | Transform vector/SVG dependencies and use lucide's real CJS entry; complete suite passes | Fixed |
| 17 | P2 | Fresh mobile typecheck depended accidentally on backend ambient Node types | Explicit types dependency and mobile tsconfig scope; isolated clean install/check | Fixed |
| 18 | P1 | Native patches contained huge generated artifacts and an obsolete version patch | Preserve Firebase source fix, remove generated/obsolete patches; fresh install applies successfully | Fixed |
| 19 | P1 | Failed patch application could still exit successfully during install | `patch-package --error-on-fail`; root and clean-install postinstall pass | Fixed |
| 20 | P1 | Production Django accepted missing/weak placeholder secret | Fail closed outside debug; subprocess configuration tests | Fixed |
| 21 | P1 | Android release signing had hardcoded fallback credentials | Require external signing properties; explicit missing-file `assembleRelease` fails with all four required fields before build | Fixed |
| 22 | P1 | Compose database used a shared default password | Require `POSTGRES_PASSWORD`, align example URL and setup instructions | Implemented; Docker unavailable |
| 23 | P2 | Dependency audit reported 72 affected packages | Compatible lockfile updates reduce to 65: 62 high, 3 moderate; fresh install passes | Partially mitigated; unresolved |
| 24 | P0 | Chat encryption fallback derives secret from public IDs with a static salt | No unsafe unilateral protocol migration; random-secret/key-exchange migration remains required | Unresolved |
| 25 | P1 | App-used deployed settings/verification routes return 404 | Read-only probes reproduced failures; full deployed server source/access unavailable | Unresolved |
| 26 | P1 | Backend pins unsupported Django 4.2.16 | Upgrade to a supported release with compatible dependencies and backend validation remains required | Unresolved |

For #24, deterministic public inputs cannot provide message confidentiality. Fixing this requires coordinated mobile/web/backend key exchange, storage and history migration; changing the mobile derivation alone would break compatibility. See [OWASP cryptographic storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html). Django's 4.2 security support ended April 7, 2026; see its [official security release announcement](https://www.djangoproject.com/weblog/2026/apr/07/security-releases/). Compose required-variable syntax follows [Docker's interpolation reference](https://docs.docker.com/reference/compose-file/interpolation/).

## Verification evidence

| Check | Result | Scope and limits |
|---|---|---|
| Root `npm run check` | PASS | TypeScript, ESLint: zero errors/217 warnings, 42 suites/184 tests passing, no skips |
| Isolated `npm ci` and `npm run check` | PASS | Fresh lockfile install in `/tmp/mdp-clean-install`; same 42 suites/184 tests; patches apply |
| Django tests | PASS | 26 tests; system check zero issues; local Python 3.9 environment, not deployed backend |
| Node backend build | PASS | TypeScript build of local `backend/`; this is only a health service |
| iOS clean Debug build | PASS | Xcode 27.0, iPhone 17 Pro/iOS 26.5 simulator, clean build with signing disabled |
| iOS simulator launch | PARTIAL | App installs and launches; runtime reaches session-recovery connection error; authenticated flows not verified |
| Android all-ABI Debug build | PASS | Retry passed with one worker and `-Xmx3g -XX:MaxMetaspaceSize=768m`; earlier attempts exhausted resources |
| Android emulator launch/discovery | PASS (limited) | APK installs/launches; existing session restores and discovery profiles render; no account mutations |
| Android complete workflows | NOT VERIFIED | No full signup/chat/payment/push acceptance |
| Release signing guard | PASS | Missing credentials cause explicit early failure; no secret output |
| Android release APK | PASS (build) | `assembleRelease` succeeded after daemon/memory fix; deployment and release-device acceptance remain unverified |
| iOS signed archive | NOT VERIFIED | No signed iOS archive produced |
| CocoaPods lock consistency | PASS | `Podfile.lock` equals installed Pods manifest; no pod update performed |
| Dependency security | FAIL | 65 unresolved audit findings; compatible fixes applied without forced major downgrades |
| Docker deployment | NOT VERIFIED | Docker unavailable locally |

Targeted diff whitespace checks pass for the audit's tracked build/config edits. A whole-workspace diff check reports pre-existing whitespace in native wrapper/manifest files; these were not rewritten.

Native builds use the workspace's existing installed dependency tree. The separate fresh-install JS checks validate the updated lockfile, but are not fresh native rebuilds. Debug builds emit dependency deprecation/run-script warnings. Lint warnings remain. Do not infer crash-free production operation or performance budgets from these checks.

Primary logs: `/tmp/mdp-final-check.log`, `/tmp/mdp-clean-final-check.log`, `/tmp/mdp-django-final.log`, `/tmp/mdp-ios-build.log`, `/tmp/mdp-android-final.log`, `/tmp/mdp-signing-guard-final.log`. Simulator evidence: `/tmp/mdp-ios-smoke-ready.png`, `/tmp/mdp-android-smoke-ready.png`. These are local audit artifacts, not durable CI outputs.

## Backend and real-workflow coverage

Read-only probes to `https://mydearpartner.in/api/v1` returned 401 for auth/me, profiles, interests, conversations, blocks, devices and notifications; this confirms reachable protected routes, not successful authenticated integration. Membership plans returned 200. Settings, verification and safety/eligibility returned 404. EligibilityBoundary currently is not wired into the main navigation, so its regression verifies component behavior rather than a live onboarding gate.

Local `backend/` only supplies health functionality. Local Django `server/` supplies payments, membership and safety modules, not the entire deployed auth/profile/chat service. No staging URL or dedicated test accounts were supplied in response to the clarification request. Existing simulator/emulator credentials were preserved. Android restored an existing session and rendered discovery profiles; iOS did not restore successfully. No live accounts were created/deleted, payments charged, push messages sent, or deployments performed.

| Module | Verified locally | Remaining real-device/backend acceptance |
|---|---|---|
| Authentication/session | Cancellation, account isolation, logout persistence, invalid response rejection | Signup, OTP, login, expiry, relaunch, logout and offline restoration on both platforms |
| Profile/onboarding | Normalization, photos service tests, derived metadata, age component failure behavior | Upload/remove/reorder photos, completion, editing and server persistence |
| Discovery/search/filters | Search/filter and tablet component regressions, normalized payloads | Pagination, actual profiles, gestures, empty/error states and different screen sizes |
| Interests/connections | Identifier handling, mutation replay prevention, sync/error regressions | Two-account send/accept/reject/cancel and resulting chat access |
| Chat/realtime | Socket/service tests, load deduplication, session boundaries | Two-device text/media, reconnect, background/resume, unread/read ordering and encrypted history |
| Notifications | Session/receiver gates and notification event regressions | FCM/APNs foreground/background/terminated delivery, taps, permissions and account switching |
| Privacy/safety | Privacy/safety unit checks; no fabricated success for unavailable eligibility endpoint | Report/block/unblock, verification, settings and server enforcement |
| Membership/payment | Payment/allowance tests and plan listing endpoint | Sandbox checkout, cancellation/failure, webhook fulfillment, renewals/refunds and account entitlements |
| Navigation/startup | Startup/root/component tests; iOS launch and Android session restoration/discovery | All routes/deep links, keyboard/back gestures, tab state and recovery on both platforms |
| Performance/accessibility | Selected layout and shared-control tests | Memory/CPU, list FPS, long chats, slow network, offline, VoiceOver/TalkBack and physical devices |

## Important files changed in this audit

- Session/security: `src/context/AuthContext.tsx`, `src/utils/keychain.ts`, `src/api/authService.ts`, `src/api/apiClient.ts`, `src/services/MessageNotificationService.ts`.
- Data/reliability: `src/context/AppDataContext.tsx`, `src/api/interestService.ts`, `src/api/chatService.ts`, `src/api/profileService.ts`.
- UI/lifecycle: `src/screens/AnimatedSplash.tsx`, `src/screens/ConnectionErrorScreen.tsx`, `src/components/EligibilityBoundary.tsx`.
- Small type/import cleanups: `src/api/paymentService.ts`, `src/services/PushNotificationService.ts`, `src/components/SafetyCenter.tsx`, `src/screens/ChatScreen.tsx`, `src/screens/main/DiscoverScreen.tsx`, `src/screens/Discover.tsx`, `src/api/discover.ts`.
- Install/build: `package.json`, `package-lock.json`, `tsconfig.json`, `jest.config.js`, `android/app/build.gradle`, `.gitignore`, `patches/@react-native-firebase+messaging+26.3.3.patch`; obsolete gesture-handler patch removed. Source-only messaging fix retained.
- Backend configuration: `server/config/settings.py`, `server/config/tests.py`, `server/docker-compose.yml`, `server/.env.example`, `server/README.md`.
- Regressions: `__tests__/authService.test.ts`, `chatService.test.ts`, `authContext.test.tsx`, `secureStorage.test.ts`, `apiClient.test.ts`, `interestService.test.ts`, `messageNotifications.test.ts`, `profileNormalization.test.ts`, `appDataReliability.test.tsx`, `eligibilityBoundary.test.tsx`, `uploadErrors.test.ts`, `animatedSplashLifecycle.test.tsx` (all under `__tests__/`).

## Required platform status

These are production acceptance gates. FAIL includes incomplete mandatory verification; it does not mean every feature is known broken.

```text
iOS: FAIL — debug build passes; authenticated workflows and signed release unverified
Android: FAIL — debug and release builds pass; full device workflows unverified
Backend Integration: FAIL — missing routes and no authenticated staging acceptance
Notifications: FAIL — regression tests pass; actual APNs/FCM delivery unverified
Chat: FAIL — predictable encryption keys; live two-device behavior unverified
Authentication: FAIL — regressions pass; complete deployed flows unverified
Performance: FAIL — no device profiling or stress acceptance
Security: FAIL — P0 chat encryption, unresolved dependency audit and unsupported Django

NOT PRODUCTION READY
```

Release closure requires the encryption migration, supported dependency/backend upgrades, restored backend contracts, dedicated staging accounts, successful signed platform artifacts and the outstanding real-device acceptance matrix. No remaining risk is waived by this report.

## Release annotation failure follow-up

The subsequently supplied release log failed in `:react-native-keychain:extractReleaseAnnotations` with `Could not initialize class org.jetbrains.uast.UastFacade`. Its reused Gradle daemon log (`daemon-29145.out.log`) records an earlier `OutOfMemoryError: Java heap space`. Stopped the daemons and saved a 3 GiB heap, 768 MiB metaspace and one worker in `android/gradle.properties`. A forced rerun of the exact release annotation task passed: 20 tasks executed, `BUILD SUCCESSFUL in 35s`, log `/tmp/mdp-keychain-release-check.log`. No lint or annotation tasks were disabled. The full `./gradlew assembleRelease --stacktrace` subsequently passed; log `/tmp/mdp-release-final.log`. Android release APK produced at `android/app/build/outputs/apk/release/app-release.apk`. This closes the supplied build failure, not the remaining security and workflow acceptance gaps. Google Play Services R8 stack-map warnings in the supplied log are warnings, not the reported task failure. Gradle memory/worker properties follow the [official configuration reference](https://docs.gradle.org/current/userguide/build_environment.html).
