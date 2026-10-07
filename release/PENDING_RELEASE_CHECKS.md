# Release closure — 7 October 2026

To configure acceptance locally, copy `release/.env.example` to `release/.env.acceptance.local`, enter the staging/test-provider values locally, then run `node scripts/release-preflight.cjs`. The local file is gitignored. The preflight never prints values or connects to external services; it checks presence only and does not certify release readiness. Physical devices, signing and actual credential validity must still be verified separately.

Local source validation: 49 suites / 227 mobile tests passed, TypeScript passed, lint had 0 errors / 220 warnings, and security-tool regressions passed. This is not live acceptance or store approval.

Current artifacts including the structured-error and realtime unconnect fixes:

- Android APK: `android/app/build/outputs/apk/release/app-release.apk`; build and signature verification passed. SHA-256: `f07b2d00956a68f758b7848012b99d42d211f9d6a6ef5abda05dfe736e496653`.
- Android AAB: `android/app/build/outputs/bundle/release/app-release.aab`; build passed and jarsigner reported `jar verified`. SHA-256: `1fe7ae587b043c20ed44d412b4b03926ba9a9aec3e9c2c1896b1d44c2a5061e9`. Self-signed certificate-chain warnings remain; the upload certificate must be checked in Play Console.
- Current iOS production JavaScript bundle exported successfully to `/tmp/mdp-latest-chat.ios.bundle`. This is not an IPA, archive or installation test.

Build logs: `scratch/release-audit-2026-10-07/mdp-latest-chat*.log`. Root-level older Production APK/AAB files were not replaced. No store upload occurred.

| Remaining item | Required evidence | Current dependency |
| --- | --- | --- |
| Chat confidentiality | A reviewed private-key protocol, interoperable mobile/web tests, legacy-history migration and key lifecycle verification | Backend/web protocol changes; current app-only scope cannot replace the public-ID-derived key safely |
| Settings/privacy | Authenticated reads and writes persist across relaunch and account changes; visibility is enforced by the service | Existing production does not expose the app's settings/privacy routes |
| Public deletion page | Hosted page at the store-declared URL, verified support channel and retention information | Local draft at `account-deletion/index.html`; hosting access and operational review required |
| Account deletion | Confirm deactivation, session revocation, recovery deadline and subsequent cleanup of each data category | Disposable test account and backend/worker evidence; app DELETE contract is corrected |
| Two-account chat/unconnect | Send and receive text/stickers; unconnect in each direction; verify both REST/socket sends are denied and neither composer remains usable | Dedicated account pair and two test clients |
| Push | Foreground/background/terminated delivery and tap navigation; mute behavior | Physical Android/iPhone with configured FCM/APNs |
| Payment sandbox | Create order, cancel/fail/succeed, verify signatures, process duplicate webhooks and confirm membership only after server fulfillment | Dedicated accounts and provider sandbox configuration |
| iOS distribution | Signed archive/export and installation on a physical iPhone | Apple distribution signing setup; no local provisioning profiles found |
| Android distribution | Current APK/AAB, matching registered upload certificate, physical-device acceptance and Play Console validation | Build artifacts can be prepared locally; device and console checks remain external |
| Dependency findings | Upstream patched braces dependency or reviewed mitigation/exposure acceptance | npm still reports 54 high findings through one advisory; local mitigation regressions pass |
| Capacity | Target peak concurrent sessions, staging load test, latency/error thresholds, database/worker monitoring and rollback exercise | Real staging infrastructure; no 3.5-million-user capacity claim is supported |

No GitHub production edits, deployment, account deletion, purchase or store submission was performed. Do not mark a row complete based solely on mocked tests, unauthenticated routing checks or an installed older simulator build.
