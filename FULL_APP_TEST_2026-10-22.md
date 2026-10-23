# Current production-readiness pass — 22 October 2026

**Status: local validation passes; production acceptance remains incomplete.**
This pass reruns checks against the current mobile checkout and the previously
prepared isolated full-backend/website source in `/tmp/mdp-production-review`.
It does not test or deploy those patches on the live service.

| Check | Current result |
| --- | --- |
| Mobile TypeScript | Passed |
| Mobile ESLint | 0 errors, 244 warnings |
| Mobile Jest | 74 suites, 418 tests passed |
| Security tool regressions | Passed |
| Local matching gateway | Build and all 13 tests passed; production dependency audit has 0 findings |
| Local Django modules | All 48 tests passed; system/migration checks passed |
| Full prepared production backend | 290 passed, 1 PostgreSQL-only test skipped |
| Targeted notification tests | 29 passed, provider delivery mocked |
| Prepared website | TypeScript, strict lint, 46 tests, production build passed |
| Android release | Lint passed: 0 errors, 24 warnings; signed APK/AAB rebuilt; APK verifies and AAB reports jar verified with warnings |
| iOS Release arm64 simulator | Unsigned native build succeeded; no physical-device/signing acceptance |
| npm production audit | 24 high findings via the braces advisory remain |
| Acceptance configuration preflight | Failed: local staging/account/provider/deployment configuration missing |

Repairs in this pass correct Android store links, remove placeholder Apple links,
validate remote store URLs and versions, derive the runtime version from package
metadata, keep mandatory updates visible after store navigation, preserve rating
eligibility after a store error, synchronize release lockfile metadata, and expand
CI to execute session and matching-gateway tests. Fifteen new regression cases
cover update routing, invalid configuration, modal persistence and rating behavior.
The version-bump script was also verified against temporary copied fixtures;
the actual app version remains 0.3.3 / Android versionCode 41.

Current signed Android artifact hashes (SHA-256):

- APK: `d9247b9ce3cd2aa685863ae8dde30c421566581bc0492b094892851955b3e097`.
- AAB: `5690c6836fb4460ecf25110457058ca21bb96f30857413068d101907bd98e651`.

APK verification confirms Signature Scheme v2; `zipalign -c -P 16 4` passes
(archive alignment only, not a native-library runtime compatibility test). AAB verification reports `jar verified`
with self-signed certificate/no-timestamp warnings and JarInputStream manifest-order
consistency diagnostics. Play Console bundle validation and upload-certificate
acceptance remain required; this is not a clean store-acceptance result.

The existing Android emulator shows the previously installed app without a crash
dialog. It was not replaced, uninstalled, or used to send messages/payments, and
does not establish acceptance of these new release artifacts. No iOS physical
device/signing or Play Console certificate acceptance was performed.

Remaining work is tracked in [current release status](release/CURRENT_RELEASE_STATUS.md):
dedicated staging/accounts, actual Apple listing configuration, backend patch
integration/deployment, sandbox checkout/webhooks, OTP/recovery, two-account chat,
real device push/uploads, signed-device acceptance, PostgreSQL/PgBouncer and
operations/load tests, shared chat cryptography migration, and dependency review.
The full app is not certified production-ready by this local pass.

Logs for this pass are `/tmp/mdp-readiness-*`; commands include `npm run check`,
`npm test` in `backend/`, Django `check`, `makemigrations --check --dry-run` and
`test --noinput`, and Gradle `:app:lintRelease :app:assembleRelease :app:bundleRelease`.
iOS used `xcodebuild -workspace ios/MyDearPartner.xcworkspace -scheme MyDearPartner
-configuration Release -sdk iphonesimulator -destination "generic/platform=iOS Simulator"
-jobs 2 ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build`.
The initial Android attempt included `:app:testReleaseUnitTest`, which this project does
not define; the corrected native command succeeds. Mobile tests are Jest tests.

## Earlier run (superseded by this pass)

# Full app verification — 22 October 2026

This run checks the current React Native checkout and the isolated repaired
production backend/website source. Local results do not certify the deployed
production service or external provider delivery.

| Check | Result |
| --- | --- |
| Mobile TypeScript | Passed |
| Mobile ESLint | 0 errors, 237 warnings |
| Mobile tests | 72 suites, 403 tests passed |
| Security tool regression checks | Passed |
| Full production backend source | 290 passed, 1 PostgreSQL-only test skipped |
| Additional notification tests | 29 passed; provider sends mocked |
| Local payments/membership/safety/session modules | 48 tests passed; Django system checks clean |
| Website | TypeScript, strict lint, 46 tests and production build passed |
| iOS | Unsigned arm64 simulator build succeeded |
| Android native lint | Passed after repairs: 0 errors, 28 warnings |
| Android release | APK/AAB rebuilt successfully; signatures verified |

Mobile tests include authentication/session state, discovery filters, removed
connections, search pagination, saved searches, hidden contact details, chat
history/delivery, notification routing/deduplication, settings/privacy, responsive
screens, uploads and payment contracts. They use mocked services where appropriate.
The Android unit-test task reports `NO-SOURCE`; the 403 mobile tests are Jest tests.

Read-only tab navigation on the installed Android debug app exercised Search,
Matches, Chats, Profile and Activity without a visible crash dialog. This is a
smoke check, not complete end-to-end coverage. Installing the signed release over
that debug app was rejected with `INSTALL_FAILED_UPDATE_INCOMPATIBLE` because the
signatures differ. The existing app/account data was preserved; it was not
uninstalled. Consequently this does not verify the latest release's device flows.

Read-only production probes:

- `/api/v1/health/`: 200.
- `/api/v1/profiles/`: 401 without authentication, as expected.
- `/api/v1/saved-searches/`: 404. The prepared saved-search backend patch is not
  available on the live API, so this feature remains blocked on deployment.

Remaining acceptance requires dedicated test accounts/devices and the intended
staging configuration: real OTP login/recovery, actual payment checkout and
webhooks, two-account chat/reconnection, real foreground/background/closed-app
push delivery, image upload moderation, and PostgreSQL concurrency. iOS signing
and physical-device behavior were not tested. No payments, messages, connection
changes, provider notifications or production deployments were performed in this
run. The first Android debug lint run failed with four errors. Fixes now move dark
navigation-bar icons into API-27-qualified resources and declare camera hardware
optional. The remaining MissingClass diagnostic was a lint false positive: the
Razorpay CheckoutActivity class was verified inside standard-core 1.7.20's
classes.jar. Only that manifest activity now suppresses MissingClass; the rest
of the lint checks remain enabled. The repeated Android lint check passes with 0 errors and 28 warnings; release
artifacts rebuilt successfully. Dependency R8/Gradle warnings remain.
CheckoutActivity was also verified in the final release APK’s DEX files.

Verified release artifact hashes:

- `android/app/build/outputs/apk/release/app-release.apk`: SHA-256 `0ad51dcaf17d5687b2a15384f569ea790d87c4cf32b86fe0cfc007199cc53fdc`.
- `android/app/build/outputs/bundle/release/app-release.aab`: SHA-256 `0c8e1da05e8fa3c9eb3636f31dd3a143b09971a5fcf1c57676905cd0965db630`.
