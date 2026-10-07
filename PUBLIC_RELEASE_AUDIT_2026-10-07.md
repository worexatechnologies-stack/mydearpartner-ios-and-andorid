# Public release audit — 7 October 2026

**Decision: not ready for public release.** Local automated checks pass, but important production routes are absent at the URLs the app calls, chat confidentiality is insufficient on the compatibility path, and live acceptance remains incomplete.

This review covers the mobile workspace, its local Express scaffold and local Django modules. The neighboring complete backend was inspected previously; its deployment is not established. Existing release documents describe earlier passes and must not be treated as current verification.

## App-only alignment with GitHub main (current implementation)

The latest source changes have now been packaged: Android APK and AAB builds passed, signatures verified, and the current iOS production JavaScript bundle exported. Current artifact hashes, warnings and remaining evidence requirements are recorded in `release/PENDING_RELEASE_CHECKS.md`. This supersedes earlier notes that the APK predates the chat-removal reliability fix. Store validation, signed iOS distribution and authenticated device acceptance remain incomplete.

Latest chat-removal reliability fix: the API client now preserves structured server error codes (including codes inside the response data envelope). MATCH_REMOVED realtime events refresh interests, conversations and the open thread; its match_removed denial disables the composer independently of message wording. **227 tests passed in 49 suites**, TypeScript passed, lint had **0 errors / 220 warnings**, and security-tool regressions passed. Evidence: `scratch/release-audit-2026-10-07/mdp-permission-realtime-fix.log`. This source change postdates the last APK. Live two-account behavior remains unverified; no production changes occurred.

Latest remediation after safety/unconnect changes: **224 tests passed in 49 suites**, TypeScript passed, lint had **0 errors / 220 warnings**, and security-tool regressions passed. Settings now reset readiness and displayed values on account changes and reject updates until loaded. The fresh Android release APK built successfully and its signature verified; logs are `scratch/release-audit-2026-10-07/mdp-final-app-remediation*.log`.

A public deletion-page draft is prepared at `release/account-deletion/index.html`, with deployment/operations review notes in its README. It is **not hosted** and does not close the missing public URL. No provisioning profiles were found in either standard local Xcode profile directory; signed iOS distribution remains pending. Strong chat confidentiality cannot be repaired by changing only this app while retaining the current server/web ciphertext protocol. No backend deployment or authenticated physical-device certification occurred.

This section supersedes earlier release-safety changes that required the newer backend contracts. The user explicitly requested app-only compatibility with the existing GitHub production code.

Per the latest instruction, GitHub production code is reference-only. No commit, push, merge or production deployment was performed. These app changes reference the original `main` commit `1ead2c422bafdf1987a7f7d81b63d4d56c9037e5`, using `git show HEAD` rather than the earlier local backend draft.

- The active app gate is now `MemberAgeBoundary`, which reads the authenticated `/api/v1/auth/me/` response and checks its recorded `date_of_birth`. Missing, malformed and underage DOBs deny member content; failures remain retryable. It no longer requests the absent eligibility endpoint. This is an app age check, **not** a server-enforced policy-attestation system or proof of identity. GitHub's registration serializer already rejects underage dates.
- Verification now uses `/api/v1/member-auth/me/documents/`, the existing authenticated document API. Uploads use `file`, `document_type` and `custom_document_name` matching the backend. Government ID, income and selfie status is derived only from `APPROVED` document rows; pending/rejected submissions remain unverified. The live document endpoint returns 401 without authentication, confirming routing only.
- Chat sending now matches GitHub main’s web-client ciphertext protocol and no longer requests the absent chat-security endpoint. Encryption failures reject sending; plaintext fallback is not used. App/web Unicode encryption round trips pass. Public-ID key derivation remains a known confidentiality limitation, and live two-account delivery is still unverified.
- Reporting now posts to the existing `/api/v1/profile-reports/` contract with `reported_member`, reason and explicit details. Conversation/message identifiers are included in details because this server has a profile-report API. A saved report ID and OPEN status are required before confirming receipt.
- Account deletion now uses `DELETE /api/v1/member-auth/account/delete/`. The app requires the server's DELETION_PENDING status and a valid recovery deadline, displays the scheduled deletion/recovery window and signs out after confirmation. No real account was deleted during validation; backend cleanup is not certified by this client change.
- Both corrected safety routes returned 401 to unauthenticated production GET probes, confirming routing only. Earlier 404 results applied to the former app URLs, not these existing routes.
- Settings controls now remain disabled when the server settings cannot load. Privacy controls already require a successful settings load. No unsupported setting is presented as saved or enforced.

Latest app-only fix validation: **49 suites / 223 tests passed**, TypeScript passed, lint had **0 errors / 218 warnings**, and security-tool regressions passed. Log: `scratch/release-audit-2026-10-07/app-only-safety-contract-check.log`. The APK from the preceding consolidated check predates these safety/settings fixes and must be rebuilt. Strong chat confidentiality, missing settings contracts, the public deletion page and authenticated/device acceptance remain release gaps.

Regression coverage verifies the screen's real document labels and multipart fields, reviewed versus pending documents, and adult/missing/underage/malformed DOB handling. Full validation results are recorded after completion below. Native artifacts built earlier predate these app-only changes.

## Release-safety fixes applied after the rechecks

This section supersedes earlier statements that the eligibility boundary is inactive, legacy encryption is used for new sends, or the declared Django stack has not been tested.

- `App.tsx` now mounts `EligibilityBoundary` inside authentication and outside session data/navigation. Signed-in member content and its session-data effects wait for the server's eligibility confirmation. Login remains available to signed-out users. A missing endpoint does **not** grant access.
- New chat sends no longer fall back to encryption derived from public member IDs on a 404. The authenticated `server-managed-v1` storage contract is required. Historical ciphertext decoding remains available. The earlier compatibility behavior was removed to meet the public-release security objective.
- The declared Python requirements were installed in isolated `server/.venv-release/`: **Python 3.14.7 / Django 5.2.17**. All **26 backend tests pass**, and `pip check` finds no broken requirements. The older environment is preserved and must not be used as evidence for the upgraded stack.
- All **54 high npm findings trace to one underlying `braces` advisory**, including dependent-package chains. There is no published patched version listed in the [advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The existing `patches/braces+3.0.3.patch` adds parser and recursive-walker depth limits. Regression checks now verify deep direct AST inputs and cyclic AST inputs at compile, expand and stringify entry points. Checks pass. This is a local mitigation; npm still flags the original package version, and that count is not hidden.
- Mobile validation after mounting the gate and removing the fallback: **47 suites / 220 tests pass**, TypeScript and lint pass with **0 errors / 218 warnings**, and security-tool regressions pass.

**Operational effect:** the current production eligibility and chat-security routes still return 404. This release candidate therefore prevents member access/chat until the matching backend contracts are deployed. Do not distribute it against the old backend. Deploying a dummy eligibility approval or security response would not resolve this requirement.

SSH to the documented production host was retried and still rejects authentication (`Permission denied`). No production files were changed. Missing API contracts, account-deletion/public alias deployment, signed iOS distribution, device acceptance and live-flow/load testing remain external release gates. Native binaries from earlier checks predate these security changes and must be rebuilt after coordinated deployment.

## Most recent full-check rerun

The repeated `npm run check` again passes **47 suites / 220 tests**, TypeScript, lint (**0 errors / 218 warnings**) and security-tool checks. The local Django suite again passes **26 tests**, and the Express backend builds. Audits remain **0 critical / 54 high** for mobile and **0 runtime findings** for the Express scaffold. These are audit findings, not 54 demonstrated exploitable mobile bugs.

Fresh production GET probes confirm the same seven app API routes and three final public URLs still return 404. Auth and conversations return 401; membership plans return 200. No authenticated write request was made. The latest detailed results are preserved under `scratch/release-audit-2026-10-07/current-recheck/`.

Native packaging evidence is from the immediately preceding review: the updated Android APK built and its signature verified, and iOS JavaScript/asset export passed. Native packaging was not repeated in this rerun. Signed iOS distribution, physical-device acceptance, two-account delivery, push, payments, actual deletion and load capacity remain unverified. The earlier 403 misclassification is confirmed fixed in source and regression coverage. The chat-key and inactive eligibility-gate findings remain open. The local Django test environment still differs from the declared requirements (Django 4.2.16 installed versus 5.2.17 declared).

**Release decision remains: not ready for public release.** No bypass or manufactured service success was added.

## Latest recheck after local remediation

Production routes were probed again after the fixes. Settings, verification, privacy settings, chat security, eligibility, reporting and deletion returned 404 in unauthenticated GET checks. Final public privacy, terms and account-deletion URLs still return 404. Authentication and conversations return 401, while the app's membership-plan URL returns 200. These probes do not validate authenticated write flows.

The fresh dependency audit still reports **0 critical / 54 high** mobile findings and **0 local Express runtime findings**. The local Django modules again pass **26 tests** and the Express scaffold builds. The full mobile recheck passes: **47 suites / 220 tests**, TypeScript, lint with **0 errors / 218 warnings**, and security-tool regressions. The latest iOS production JavaScript bundle and asset export pass. Android initially failed during bundling due to a shared Metro-cache collision with the concurrently running iOS bundle; the sequential retry **passed**, and APK signature verification passed. This was an environment/cache collision, not an unresolved app build failure. New evidence is under `scratch/release-audit-2026-10-07/latest-recheck/`.

## Local remediation after the audit

The 403 chat handling defect is fixed: a forbidden send now checks the block endpoint and disables the composer only after a confirmed block. Failed sends retain the draft and show the server error. Two regression cases cover plan denial and actual blocking.

Compatible dependency updates installed `shell-quote` 1.12.0, `proxy-addr` 2.0.8 and `qs` 6.16.0. The mobile audit now has **0 critical / 54 high** findings; the local Express runtime audit has **0 findings**. Remaining mobile findings still need exposure review. A shell comment/newline injection regression was added to the existing security-tool check.

Validation after these changes: **47 suites / 220 tests pass**, TypeScript passes, lint has **0 errors / 218 warnings**, security-tool regressions pass, and the Express backend builds. The latest recheck built a fresh Android APK incorporating these changes; see its hash below. Store acceptance remains unverified.

No eligibility, verification, privacy, report or deletion response was fabricated. Their missing production contracts, chat's legacy-key limitation and public-page deployment remain unresolved. Mounting the existing eligibility boundary while its live endpoint returns 404 would stop current members entering the app; deployment and activation remain a coordinated release requirement rather than a silent bypass.

## Checks performed

| Check | Result | Limits |
| --- | --- | --- |
| `npm run check` | Passed: TypeScript, lint with 0 errors / 218 warnings, 47 Jest suites / 218 tests, security-tool regressions | Native modules, API replies and many integrations are mocked in Jest |
| Local Django tests: safety, payments, memberships, config | 26 passed | Installed environment is Python 3.9.6 / Django 4.2.16, while requirements specify Django 5.2.17; tests do not validate the declared dependency stack or deployed Django |
| Express `npm run build` | Passed | This backend implements `/api/health` only; it cannot provide the app's auth/profile/chat APIs |
| iOS production JavaScript bundle and asset export | Passed | Not a signed iOS archive or device acceptance test |
| Fresh offline Android release APK build | Passed in 5m 29s; APK signature verification passed | Build success alone does not establish store acceptance or functional delivery |
| Read-only live HTTPS route probes | Completed | No bearer token; 401 proves route reachability, not working login. A 404 may also be masked by routing/auth, so authenticated retesting is required |
| Current booted iOS simulator | Profile screen rendered; one screenshot visually inspected | Existing installed app and account; no claim of a newly installed release or complete UI walkthrough |
| Dependency audits | Findings below | Advisory counts include dependency chains and build tools, not independent demonstrated exploits |

## Confirmed findings and release gates

### 1. Production API contract mismatch — high

Unauthenticated GETs returned **404** at:

- `/api/v1/settings/` — the app loads and updates general settings here.
- `/api/v1/verification/` — verification status.
- `/api/v1/member-auth/privacy-settings/` — privacy controls.
- `/api/v1/safety/eligibility/` — existing-account eligibility contract.
- `/api/v1/safety/reports/` — the app posts safety reports here.
- `/api/v1/safety/account-deletion/` — the app posts account deletion requests here.
- `/api/v1/member-auth/chat-security/` — the new server-managed chat storage contract.

GET probes do not exercise POST/PATCH behavior; however, missing routes must be resolved and the authenticated write flows verified before release. The app's source callers are `settingsService.ts`, `verificationService.ts`, `safetyService.ts`, and `crypto.ts`.

`/api/v1/auth/me/` and `/api/v1/conversations/` returned **401**. `/api/v1/membership-plans/`, the actual plan URL used by the app, returned **200**. An exploratory `/api/v1/memberships/plans/` probe returned 404 but is **not an app defect**, since the app does not use it.

### 2. Public policy and deletion pages are missing — high

`/policies/privacy/`, `/policies/terms/`, and `/account-deletion/` redirect with 308 to the corresponding URLs without trailing slashes. Those final URLs return **404**. Embedded policy text exists inside the app, but it does not repair these public URLs or demonstrate actual data deletion.

### 3. Chat compatibility encryption does not establish a private key — high

The recent app compatibility fix lets old servers accept encrypted web-compatible messages when the security endpoint returns 404. `src/utils/crypto.ts` derives the legacy key from sorted member IDs and a fixed salt using PBKDF2. Member identifiers are not a secret. Anyone with the identifiers and ciphertext can derive the same key; random IVs do not fix that problem.

The change restores protocol compatibility, **not strong chat confidentiality**. The newer server-managed storage contract must be deployed and validated, or a properly designed private key exchange must replace the legacy path. End-to-end message delivery between two accounts is still unverified.

### 4. Existing-account eligibility boundary is inactive — high

`EligibilityBoundary.tsx` has tests and implementation, but `App.tsx` and active navigation do not mount it. Registration has an adult-DOB check, which does not establish enforcement for existing accounts. Production entitlement/age enforcement at member APIs and sockets must be verified; server enforcement cannot be inferred from the client alone.

### 5. Chat treats every 403 as blocking by the partner — medium, fixed locally

At audit time, in `ChatScreen.tsx`, the send error handler called `setBlockedByThem(true)` for any 403. A membership or messaging-entitlement denial can also be 403. This incorrectly disables the composer and suggests the partner blocked the user. The app should distinguish the server's structured denial code before setting blocked state.

### 6. Dependency findings require exposure review — high

Fresh npm audits reported:

| Scope | Critical | High | Moderate | Total |
| --- | ---: | ---: | ---: | ---: |
| Mobile workspace, all dependencies | 1 | 54 | 0 | 55 |
| Mobile workspace, omit dev dependencies | 1 | 24 | 0 | 25 |
| Local Express backend, omit dev dependencies | 1 | 0 | 1 | 2 |

The mobile critical finding is `shell-quote`, with a patch in 1.11.0: [maintainer advisory](https://github.com/advisories/GHSA-pqg4-j6r4-53mv). It concerns shell command construction; its appearance in an npm runtime audit does not establish execution inside the installed mobile app. Trace CLI/Metro and build exposure.

The local Express critical finding is `proxy-addr`: [maintainer advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h). It concerns trust-subnet IP spoofing. This scaffold does not enable `trust proxy`, and it is not established as the deployed production backend, so exploitation is not demonstrated here.

Security-tool regression checks pass for selected patched tools, but they do not close every audit finding. Do not blindly apply npm's suggested major-version downgrades; review versions and affected call sites.

### 7. Scale remains untested — release capacity gate

Active sessions refresh interests and chats every 15 seconds in `AppDataContext.tsx`, including sessions where realtime sockets are available. Each cycle normally requests sent interests, received interests, and conversations. At 10,000 continuously active users, that is approximately 2,000 requests/second before discovery, media, message history, retries, or payments. This estimate is not a load-test result.

No evidence certifies capacity for 3.5 million registered users or any particular concurrent-user count. Define the peak active-user target and test the actual backend, PostgreSQL, Redis, sockets, notification workers and media delivery in staging.

## Build warnings and environment limits

The Android build emitted R8 invalid-stack-map warnings for Google Play Services Auth 21.5.0. This does not by itself prove a runtime failure, but the minified release must exercise any Google authentication flow on a real device. Metro also emitted a React Native feature-flags package-export fallback warning. These are recorded in build logs.

The workspace has only a few GiB of free disk space during native builds; a fresh dual-platform build can fail due to environment capacity. This is a developer-machine constraint, not evidence of an app-user storage issue.

## Remaining acceptance work

- Fresh signed iOS archive/export and physical-device testing. Prior release execution recorded missing provisioning profiles; this audit did not repeat or resolve signing. Device discovery found a simulator and an offline iPad, not a connected physical test device.
- Dedicated two-account tests: signup, login, expired-token refresh, profile/photo persistence, interest acceptance, text/stickers, unread counts, blocking, reporting and deletion.
- APNs/FCM delivery while foregrounded, backgrounded and terminated, including notification tap navigation and muted-chat behavior.
- Payment sandbox tests: order creation, verification, webhook authenticity/idempotency, reconciliation, cancellation and entitlement activation. Local payment tests pass; no real or sandbox purchase was made in this audit.
- Offline/reconnect behavior, server outages, large profiles/chat histories, accessibility and physical Android/iOS UI acceptance.
- Verify real deletion processing, backups/restore, monitoring, rate limiting and rollout/rollback against the deployed backend. These are unverified operational requirements, not claimed missing implementations.

No production mutations, payments, account changes or publication occurred. Passing local checks is useful evidence, but it does not close the production and acceptance gaps above.

## Evidence

Logs and machine-readable audit/route results are saved in `scratch/release-audit-2026-10-07/`. The simulator screenshot was kept in `/tmp` and is not included in repository evidence because it displays account information.

Fresh APK: `android/app/build/outputs/apk/release/app-release.apk` (version 0.3.1 / code 36). SHA-256: `ae4bb3bc275e2105a47b2af2501055086f6ea803c9a032682e4f9f60ff7fecbd`. No store submission was performed.

Latest recheck APK SHA-256: `4ea75b0fe8afb103093e2862528bbeb43a986ac9586b62025f4137318fbfc957`. APK signature verified. The earlier hash above refers to the pre-remediation build.

Public URL correction during remediation: `https://mydearpartner.in/privacy` and `https://mydearpartner.in/terms` return **200**. The previously tested `/policies/privacy` and `/policies/terms` aliases still return 404; this does not establish that all public policy content is absent. Use the working URLs for store metadata after reviewing their current contents. The public `/account-deletion` URL remains missing. No store metadata was changed.

Final local packaging remediation: added `server/.dockerignore` to exclude `.env` secrets, local databases, Python environments, bytecode, git metadata and logs from Docker image layers. The complete mobile checks still pass (220 tests), and the declared Django environment passes all 26 tests. Production eligibility, chat security and account-deletion routes were checked again and still return 404. SSH authentication is still rejected and the agent has no loaded identities. No production deployment or release certification is claimed.

App-only GitHub alignment validation: Test Suites: 49 passed, 49 total; Tests:       222 passed, 222 total. TypeScript, lint (0 errors / 218 warnings) and security-tool regressions pass. GitHub production files were not pushed or deployed. Rebuild/reload the mobile app to apply these changes; live authenticated acceptance remains outstanding.

## Acceptance execution after app-only alignment

### Consolidated recheck requested on October 7, 2026

- Mobile: all 49 suites / 222 tests passed; TypeScript passed; lint had 0 errors and 218 warnings; security-tool regression checks passed.
- Local Django modules: all 26 tests passed with no system-check issues. Local Express scaffold compiled successfully; it is not the deployed backend.
- Fresh Android release APK built successfully in 3m 17s and its signature verified. SHA-256: `cd9459b2483ba59c1de4a35a04256289b2efd4ecc83649e95c893854411a8125`.
- Current iOS production JavaScript bundle exported successfully. This is not a signed iOS archive or physical-device acceptance.
- Mobile npm audit: 54 high, 0 critical findings, tracing to the braces advisory and dependent packages. Local mitigation regression tests passed; the audit is not clean. Local Express runtime audit: 0 findings.
- Fresh unauthenticated production probes: auth, conversations and member documents returned 401; plans, privacy and terms returned 200. Settings, privacy settings, safety reports, safety account deletion and the public account-deletion page returned 404. GET status checks do not validate authenticated writes.
- No physical Android/iPhone was available. Two-account chat, real push, payment sandbox, live reporting/deletion, iOS signing and capacity acceptance remain unverified. Public-ID-derived chat keys remain a confidentiality concern.

Evidence: `scratch/release-audit-2026-10-07/all-at-once/`. No production mutation, GitHub push or publication occurred. **Public release remains blocked.**

The requested acceptance pass ran the available checks. Eight focused suites passed all **33 tests**, covering chat service/socket behavior, encryption preparation, message notifications, payment service, safety, verification document mapping and the member age boundary. These are automated tests with mocked external dependencies; they do not prove production delivery, APNs/FCM delivery, successful checkout or deletion processing.

| Acceptance check | Result and limit |
| --- | --- |
| Installed iOS simulator launch | Passed: the installed app opened and rendered an existing chat. This installation was not rebuilt during this pass, and existing message ticks do not establish new delivery. |
| Physical Android/iPhone availability | No Android device attached; no physical iPhone available. An iPad was listed offline. |
| Dedicated two-account chat/push testing | Not executed: no configured dedicated account pair found in the app or adjacent backend checkout. No message sent to a real member. |
| Payment sandbox | Not executed: no configured sandbox credentials found. No purchase attempted. |
| Reporting/deletion acceptance | Not executed against a live account. No account changed or deleted. |
| Configuration search | Reviewed app/backend configuration files, release/QA documentation, adjacent backend e2e instructions and relevant environment-variable names. Found local database configuration and example e2e settings, not usable staging account credentials. Secret values were not printed. |

Focused test output: `/tmp/mdp-acceptance-focused.log`. Simulator screenshot remains outside repository evidence because it includes account information. No GitHub production changes or deployment occurred. Public-release certification remains pending authenticated acceptance, supported production contracts, physical-device checks and the unresolved chat confidentiality limitation described above.
