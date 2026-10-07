# Application audit and fixes

This is a code audit, automated regression pass, native build check, and limited iOS simulator smoke test. It is **not a claim that every user flow has passed end-to-end testing**. The working tree already contained substantial changes before this audit; those were preserved.

## Architecture reviewed

React Native screens → AuthContext/AppDataContext → API services → central authenticated HTTP client → production Django API (`https://mydearpartner.in/api/v1`). Chat also uses Django Channels WebSockets. FCM/APNs deliver pushes; Notifee presents local notifications. Authentication uses Keychain. Local storage retains preferences and caches. The workspace additionally contains a Node backend and a separate Django payment/membership implementation; neither is evidence of what is deployed remotely.

Reviewed authentication, profile setup/editing, discovery/search, interests/connections, chat, notification services, settings, blocking, verification, membership/payment boundaries, navigation, storage, encryption, and native permissions/configuration.

## Confirmed bugs corrected

Unless specified, these changes affect both Android and iOS.

| Severity | Area | Root cause and resulting fix | Files | Verification |
| --- | --- | --- | --- | --- |
| High | Profile setup | API failures were caught and profile completion was set in `finally`. Failures now reach the screen and completion follows the saved response. | `src/context/AuthContext.tsx` | Auth context regression test |
| High | Profile Setup Loop | The PATCH `/auth/me/` often returns partial/success envelopes causing `isProfileComplete` to evaluate to false. Now explicitly fetches the full profile after update. | `src/api/profileService.ts` | Code review |
| High | Session restore | Every restored profile was marked complete. Restored profiles now use the same required-field check as login. | `src/context/AuthContext.tsx` | Incomplete-profile restore test |
| High | Tablet UI | Auth screens were stretched full width on iPads and tablets. Added `maxWidth: 600` and `alignSelf: 'center'` constraints. | Auth screens | Visual validation |
| High | Android Build | Stray characters and missing/deprecated `translucent` types on `StatusBar` broke Babel parser during release bundling. Reverted to `true as any` to fix types, fixed stray characters. | `SplashScreen.tsx`, Auth screens | Native build check |
| High | Android C++ | React Native screens codegen race condition broke CMake cache. Added `mkdir -p` and cleared `.cxx/build` before running `bundleRelease`. | Background shell | Native build check |
| High | Login | Any profile-fetch failure became an empty profile, sending existing users into setup. Only a 404 now permits this fallback. | `src/context/AuthContext.tsx` | Code review, typecheck |
| High | Verification | Failed uploads fabricated verified flags and stored them locally. Only server responses can now establish verification. | `src/api/verificationService.ts` | Failure regression tests |
| Medium | Verification UI | A submitted-but-pending selfie displayed “verified”. Success copy now follows the returned status. | `src/screens/member/VerificationScreen.tsx` | Code review |
| High | Settings/blocking | Missing endpoints were treated as successful writes. Errors now propagate, allowing existing UI rollback/error handlers to run. | `src/api/settingsService.ts`, `src/api/blockService.ts` | Missing-endpoint tests |
| High | Password reset | Email identifiers were reduced to digits; final fallback verified an OTP without changing the password. Email is preserved, login fallback removed, and alternate reset endpoints tried only for 404/405. | `src/api/authService.ts` | Email, invalid-OTP, and fallback tests |
| High | API timeout | Timeout timers were never cleared and requests continued running. Requests now abort on deadline and release timers, including while reading response bodies. | `src/api/apiClient.ts` | Abort/timer regression tests |
| High | Token refresh | Refresh had no deadline, mishandled envelopes/rotation, and logged users out during network failures. Refresh is bounded, shared across requests, accepts envelopes/rotation, and preserves sessions on transient failures. | `src/api/apiClient.ts` | Concurrent refresh, outage, and rejection tests |
| High | API response handling | `success:false` inside HTTP 200 could become success. JSON and upload paths now reject explicit failure envelopes. | `src/api/apiClient.ts` | Response and upload regression tests |
| High | Token storage | Native secure-storage failures wrote tokens to plaintext AsyncStorage. New writes require Keychain; legacy plaintext tokens migrate before use. | `src/utils/keychain.ts` | Secure storage/migration tests |
| High | Account lifecycle | Cached identities and message deduplication survived logout; pending crypto restoration could revive old identity. Logout clears tracker memory and invalidates pending crypto initialization. | `src/utils/notificationTracker.ts`, `src/utils/keychain.ts`, `src/services/MessagingCryptoLifecycle.ts` | Lifecycle tests |
| High | App data isolation | In-memory app data provider persisted across account changes. Provider is now keyed by account, and identity-loading effects are cancelled on cleanup. | `App.tsx`, `src/context/AppDataContext.tsx` | Code review, app render test |
| High | Persistent account isolation | Mute lists, shortlists, dismissed-notification IDs, and local settings shared AsyncStorage keys across accounts. These entries now use account-scoped keys. | `src/utils/storage.ts`, `src/context/AppDataContext.tsx`, `src/screens/member/SettingsScreen.tsx`, notification services | Account storage regression test |
| High | Chat reconnect | Deferred credential loading could open sockets after leaving chat; old close listeners could reconnect. Generation checks and listener cleanup now prevent those paths. | `src/api/wsClient.ts` | Socket lifecycle tests |
| Medium | Chat messages | String `message` payloads were treated as nested objects, losing text/sender information. Flat and nested payloads are handled separately. | `src/api/wsClient.ts` | Message payload test |
| Medium | Edit profile | Age, diet, horoscope, and prompts were silently omitted from writes. They are now included. Profile update envelopes are normalized consistently with reads. | `src/context/AuthContext.tsx`, `src/api/profileService.ts` | Auth context and profile envelope tests |
| Medium | Profile data | Null/partial responses could crash or produce undefined strings; capitalized gender broke local comparisons; contact unlocks used interest limits. Added validation/defaults, gender normalization, and correct contact field mapping. | `src/api/profileService.ts` | Profile normalization tests |
| Medium | Profile setup | Missing/invalid ages became 25, missing names/cities were fabricated, and a demo photo was inserted. Required fields and age are now validated. | `src/screens/ProfileSetupScreen.tsx` | Typecheck and code review |
| Medium | Login/signup | Demo credentials were prefilled; whitespace identifiers and invalid email/short passwords were accepted by the form. Removed prefill and added basic form guards. | `src/screens/auth/LoginScreen.tsx`, `src/screens/auth/SignupScreen.tsx` | Typecheck and code review; backend remains authoritative |
| Medium | Shortlist | Failed mutations left optimistic state saved as though successful. Mutation failures now roll back and show an error; refresh failures do not undo successful mutations. | `src/context/AppDataContext.tsx` | Code review |
| Medium | Mute | Values computed inside a React updater were read before the updater necessarily ran. Next state is now calculated before persistence. | `src/context/AppDataContext.tsx` | Code review |
| Medium | Notification navigation | React Navigation can ignore unavailable routes without throwing, losing notification links during login. Route availability is checked before consuming links. | `src/navigation/navigationRef.ts`, `src/navigation/RootNavigator.tsx` | Navigation queue regression test |
| Medium | iOS interest alerts | Foreground iOS alerts were marked delivered without displaying. They now use the shared system-notification path; OS-rendered background alerts remain excluded. | `src/services/InterestNotificationService.ts` | Interest notification tests |
| Medium | Refresh performance | Multiple foreground listeners refreshed the same data, and chat polling could overlap slow requests. Removed redundant navigator refresh and added chat-list single-flight protection. | `src/navigation/RootNavigator.tsx`, `src/context/AppDataContext.tsx` | Code review |
| Medium | Diagnostics/privacy | All LogBox warnings were suppressed; full push/chat/profile payloads and crypto derivation seeds were logged. Removed blanket warning suppression and those payload/seed logs. | `App.tsx`, `src/api/chatService.ts`, `src/context/AuthContext.tsx`, `src/utils/crypto.ts` | Source inspection |
| Low | Checks | Unused notification imports/variables blocked lint. Tests expected obsolete in-app banners despite the single-system-notification design. Removed dead code and updated assertions to the intended behavior. | Notification services, AppDataContext, notification tests | Full lint/test run |

Earlier in this session, message notifications were also fixed: removed the chat-list title lookup, enabled foreground iOS presentation, prevented concurrent duplicates, preserved retries after failed display, and replaced dynamic React Native imports that caused an iOS native-emitter runtime error. A simulated foreground push displayed a system banner on the iPhone 17 Pro simulator.

## Live backend connection checks

Read-only unauthenticated GET requests were made; no production accounts, interests, messages, payments, or profiles were created or modified.

| Endpoint | Observed status | Interpretation |
| --- | --- | --- |
| `/auth/me/`, `/profiles/`, `/interests/`, `/conversations/` | 401 | Server reachable; authenticated behavior not proven by this check |
| `/blocks/`, `/devices/`, `/notifications/` | 401 | Server reachable; mutations/push registration not proven |
| `/membership-plans/` | 200 | Public plan listing responded |
| `/settings/`, `/verification/` | 404 | These requests cannot load these features; deployed routes/authenticated behavior require backend investigation |

The app no longer hides missing write endpoints with fake success. The deployed settings/verification implementations were not added or deployed during this audit.

## Remaining issues and verification limits

- **Critical security design:** chat keys derive from public member IDs plus a fixed salt. Someone who knows those IDs can derive the same keys. This is not strong end-to-end secrecy. A versioned protocol with genuine private key material, key exchange, and migration across mobile/web/notification extension is required. Silently changing derivation would break existing conversations.
- The 404 settings and verification responses need backend investigation/implementation.
- Previously global local mute, shortlist, dismissed-notification, and settings values are not migrated into the new account-scoped keys; these preferences may reset once after upgrade. Other persistent cache scopes should be reviewed as the app adds account-specific storage.
- Some legacy chat/API routes still use compatibility fallbacks. Their authenticated request/response contracts need confirmation against the deployed backend.
- Real two-account send/receive/accept/decline/block flows, SMS/email OTP delivery, media uploads, live checkout/webhooks, live FCM/APNs delivery, notification taps in every lifecycle state, offline network transitions, and physical-device camera/background behavior remain unverified end to end.
- iOS simulator launch/discovery and earlier simulated push presentation were observed. Every screen/control was not driven interactively. No Android device was connected.
- Release signing, store archives, and physical-device release builds were not verified.
- ESLint still reports pre-existing style/shadow/bitwise warnings. They are reported, not suppressed.

## Validation

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed |
| ESLint (`npm run lint`) | Passed with 0 errors and 171 warnings (mostly inline-style warnings; see lint output) |
| Jest (`npm test -- --runInBand`) | Passed: 22 suites, 66 tests |
| Android debug (`./gradlew assembleDebug`) | Passed: `BUILD SUCCESSFUL`; Gradle/dependency deprecation warnings remain |
| Node backend (`npm run build`) | Passed |
| Django payment tests (`python manage.py test payments --noinput`) | Passed: 3 tests; Django system checks clean |
| iOS simulator app | Latest debug build installed and launched on iPhone 17 Pro simulator; an earlier smoke test displayed Discover |
| iOS Xcode debug build | Passed on retry (simulator destination, exit code 0); dependency deprecation and run-script phase warnings remain. |
| Android device run | Not performed: `adb devices` showed no connected emulator/device |
| Backend | Read-only route checks only; authenticated flows and mutations were not exercised |

The simulated message push was visibly presented during the notification check. The app reached the Discover screen in a simulator smoke test. Every screen/control was not interactively exercised. Test fixtures exercise failure conditions; they are not used as application fallback data.
