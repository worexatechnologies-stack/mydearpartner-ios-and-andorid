# UI/UX audit and verification — 6 October 2026

## Scope and evidence

This is a code audit and targeted regression/visual pass. It is not a certification that every production flow has passed a complete physical-device matrix. No payments, messages, account deletion, block actions, verification submissions or profile edits were sent to production during QA.

## Architecture

- Bare React Native 0.87.0 / React 19.2.3, TypeScript; native iOS Xcode and Android Gradle projects. No Expo project.
- React Navigation native stacks with five bottom tabs. Auth chooses Welcome/Login/Signup/ForgotPassword, ProfileSetup or Main based on restored session and profile completion. Splash and connection errors are state-driven screens.
- AuthContext and AppDataContext own state, cached profiles, interests, chats and refresh/error states. The installed React Query package is not the active app architecture.
- Central REST client targets the existing Django API; token refresh and user-facing error normalization are centralized. WebSocket and realtime services provide chat, presence and notifications.
- Keychain stores credentials; account-scoped persistent storage holds local preferences and shortlist state. Existing encryption/session lifecycle is retained.
- Firebase Messaging and Notifee handle push, notification taps and realtime events. Profile deep links use `mydearpartner://profile/:profileId`.
- Shared components include AppButton, AnimatedButton, AppTextInput, ScreenContainer, AuthImage, EmptyState, LoadingState, SkeletonCard, UndoSnackbar, OfflineBanner and SafetyCenter.
- The existing theme is retained and expanded with shared action/blush/border colors and minimum interaction metrics. Ionicons, Lucide, SVG, native fonts, local images, React Native Animated and Reanimated are used.
- Native dependencies include safe-area, gestures/screens, blur, image picker, video/WebView, crypto, Firebase, notifications and Razorpay. Android declares adjustResize for keyboard layout.

## Screen inventory

| Screen | Audit / checks |
| --- | --- |
| AnimatedSplash | Legacy unregistered splash implementation; no active navigation route; lifecycle unit test retained. |
| ChatScreen | Existing keyboard, crypto, message, reconnect and notification regressions pass at baseline; custom header reviewed. |
| ConnectionErrorScreen | Scrollable error card and retry action; session error routing covered by auth tests. |
| Discover | Legacy standalone discovery screen; Main uses main/DiscoverScreen; retained to avoid deleting existing work. |
| EditProfileScreen | First-tap input controls and keyboard dismissal; both prompt modals have Android Back handlers. |
| ProfileDetailScreen | Separate safe footer, rounded gallery, modal Back; interest and messaging actions retained. |
| ProfileSetupScreen | Scrollable keyboard-safe inputs and completion routing reviewed; photo permissions need physical-device checks. |
| SplashScreen | Preview animation, reduced motion, completion and cleanup regression tests; Android visual capture. |
| ForgotPasswordScreen | Email, OTP and password reset are internal steps; validation, scroll and keyboard layout reviewed. |
| LoginScreen | Added autofill, accessible labels, busy state and guarded submit; keyboard-safe scrolling reviewed. |
| SignupScreen | Adult DOB, terms consent, disabled submission, secure password and policy modals reviewed. |
| WelcomeScreen | Scrollable safe-area layout; navigation reviewed; dedicated device flow still pending. |
| ChatsListScreen | Actual tab-bar clearance and keyboard tap behavior; search/empty/error/new-match layout reviewed. |
| DiscoverScreen | Paged single profile; large-text/landscape fallback; working filters; correct Nearby; iOS and Android visual capture. |
| InterestsScreen | Connected tab deduplication and chat tested; pending tab counts match data; larger-text paging fallback. |
| MyProfileScreen | Header and photo badges corrected earlier; quota/stat cards now stack for narrow screens or enlarged text. |
| SearchScreen | Responsive 1/2/3/4-column grid; real filters; keyboard tap handling; modal Back; blank city/language exclusion. |
| BlockedScreen | 48-point tab/block/unblock targets; confirmation and error handling reviewed. |
| CompareScreen | Android picker Back added; existing received/sent/accepted relationship action tests. |
| MembershipScreen | Scroll/safe-area and native checkout flow reviewed; no purchase made; sandbox end-to-end checkout pending. |
| NotificationsScreen | Wrapping header/actions and readable captions; removed unsupported match-score claim from welcome copy. |
| SettingsScreen | Queued preference writes, rollback, privacy loading states and logout confirmation reviewed. |
| VerificationScreen | Android camera modal Back; selfie review copy corrected; physical camera/permission paths pending. |
| VisitorsScreen | 48-point action targets; readable shared secondary text; profile/send/unsend routing reviewed. |

OTP and reset password are steps of ForgotPasswordScreen, not detached routes. Filters and comparison pickers are modals; Terms, Privacy, Community Safety, Report and Account Deletion use SafetyCenter. Help currently opens the support contact instruction in Settings. There is no separate About screen or standalone onboarding route beyond Welcome. Removed stale `Splash` and `PaymentWebView` type declarations: neither was registered; actual splash routing and native checkout remain unchanged.

## Fixes in this pass

1. All active native modals now expose onRequestClose for Android hardware Back.
2. Discover filters open the existing Search filter sheet instead of a placeholder alert.
3. Nearby uses actual city matching and recognizes Bangalore/Bengaluru. Blank city or language no longer passes Search's shortcut filters. Missing own-profile information prompts completion.
4. Shared contrast: primary action fill is dark enough for small white text; formerly faint tertiary labels use readable secondary text. Contrast regression requires at least 4.5:1 for these pairs.
5. Profiles preserve one card per viewport normally. Short landscape viewports and enlarged text reserve enough space and allow scrolling instead of clipping controls.
6. Profile quotas/stat cards stack when needed; notification headers wrap; tablet Search adds columns rather than inflating two cards.
7. Login has appropriate autofill, secure field metadata, accessible names, loading state and guarded submission with finally cleanup.
8. Edit and Search inputs support first-tap control interaction and keyboard dismissal. Refresh indicators reset even if refresh rejects.
9. Notification, shortlist and filter controls gain labels/state. Shared animated controls gain expanded hit areas; small Visitors/Blocked actions have 48-point minimum height.
10. Offline banner accounts for notch/inset and its measured height, including wrapped larger text. Chat list uses measured bottom-tab clearance.
11. Activity's Received/Sent data now matches pending counts, while accepted people remain in Connected. Unavailable profiles show an explicit retry page instead of disappearing and breaking paging.
12. Removed unsupported verification/match marketing claims from notification and selfie copy.
13. Profile badge animation respects the system Reduce Motion setting. Both ends of the primary action gradient meet the white-text contrast requirement.

## Automated checks

Baseline: 45 Jest suites and 193 tests passed. Final `npm run check` passed: TypeScript has zero errors; ESLint has zero errors and 208 warnings; all 46 Jest suites and 203 tests pass. Warnings mainly concern existing inline styles and bitwise crypto operations. Added responsive paging, offline inset, contrast, Nearby and working-filter regressions. After the last contrast/Reduce Motion adjustment, TypeScript and targeted ESLint also completed with zero errors.

## Device evidence and limits

Android native validation: `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a --max-workers=2` passed (849 tasks), and the resulting APK installed successfully with `adb install -r`. The initial all-ABI build was stopped to reduce host/emulator load; this result validates arm64 debug packaging, not every release ABI. Existing OpenSSL/native and Gradle deprecation warnings remain. No fresh iOS native build or release signing was performed in this pass. Repository-wide `git diff --check` reports pre-existing native-file whitespace (including CRLF Gradle batch scripts); those unrelated files were not rewritten.

Available: booted iPhone 17 Pro (iOS 26.5), plus Pixel_10a Android emulator started for this pass. iOS current Profile and updated Discover were visually inspected from simulator screenshots. Android splash and updated Discover were visually inspected using the current Metro bundle. Initial Android tab captures were invalidated by stale hot-refresh warnings and emulator system/launcher responsiveness dialogs. After a clean emulator restart and successful debug APK install, all five main tabs switched successfully. Search, Activity Received empty state, Connected profile, Chats list and My Profile were captured and visually inspected; Profile's bell and allowance footer are visible, and the Connected profile/chat action fits above the navigation bar. Evidence is saved in `scratch/ui-qa/ios-discover.png`, `android-splash.png`, `android-clean.png`, `android-search.png`, `android-activity.png`, `android-connected.png`, `android-chats.png` and `android-profile.png`.

Responsive automated cases cover small/standard/large phones, tablet, landscape and 2x font scale. iOS content-size setting was returned to its original `large` value after inspection. These checks do not replace the full physical iPhone/Android matrix, VoiceOver/TalkBack traversal, font-size extremes, real camera permission denial, offline/cold restart, or sandbox checkout tests. Production session-expiry/logout and account creation were not forced because the available app uses real backend sessions. Their existing automated coverage remains available.


## Release remediation update — 6 October 2026

Save Profile clipping was corrected in the shared AppButton and visually verified in the iOS simulator. Verification now provides loading/error/retry states and no longer shows a fabricated trust score. The date picker aligns its selected value correctly. The current mobile checks pass 47 suites / 207 tests, TypeScript and lint (zero errors). Full frontend/backend remediation and remaining public-release gates are recorded in [RELEASE_FIXES.md](RELEASE_FIXES.md); production and signed physical-device acceptance remain unverified.


### Eligibility picker follow-up

Replaced the three virtualized date lists nested inside the page ScrollView with bounded ScrollView wheels, preserving fixed-row snapping and selection. TypeScript passes and targeted lint has zero errors. Added regression coverage for wheel selection and unavailable eligibility routes. A read-only live request to `/api/v1/safety/eligibility/` returned HTTP 404 on 6 October 2026; the screen now explains the missing server service. The complete backend implementation still needs deployment; no local approval bypass was introduced.


### Eligibility screen removal

At the user’s explicit request, removed EligibilityBoundary from the active App.tsx startup tree. Normal authentication/navigation now opens without the date-of-birth/consent screen. The standalone component and backend implementation remain in source. No consent records are fabricated, and backend enforcement is unchanged.


### Complete release remediation follow-up

Mobile now passes 47 suites / 211 tests with TypeScript and zero lint errors. The complete backend passes 278 tests, one skipped, with no failures/setup errors. Updated retired Staff/Support coverage for the requested Member/Admin/Super Admin design and fixed actual Admin lookup, expired-trial fallback, cleanup audit and signup consent defects. The removed eligibility startup screen remains removed; signup records current-policy consent explicitly. Web policy content is available locally at `/safety`. Live deployment and fresh signed-device acceptance remain outstanding; see RELEASE_FIXES.md.


### Native release builds — 6 October 2026

Fresh signed Android APK/AAB builds succeeded and their signatures were verified. iOS Release arm64 simulator compilation, installation and launch succeeded. Corrected the iOS notification extension Release signing team to match the main app. Signed iOS distribution remains blocked by provisioning profiles, and production is unreachable from this execution session. Detailed artifact hashes, logs and limitations are in RELEASE_EXECUTION.md.
