# App health review — 22 October 2026

Full rerun results and device/deployment limitations are recorded in
[FULL_APP_TEST_2026-10-22.md](FULL_APP_TEST_2026-10-22.md).

## Latest readiness pass

The latest mobile run passes 74 suites / 418 tests, TypeScript and security
checks, with 0 lint errors / 244 warnings. All 48 supplementary Django tests and
13 matching-gateway tests pass. CI now includes the session and gateway tests.
Store links, mandatory update persistence, malformed version handling, rating
failure state and release metadata synchronization are repaired. Android release
lint passes with 0 errors / 24 warnings; APK/AAB rebuilds succeed. The current
artifact hashes, native results and signature limitations are in the full app
report above. [Current release status](release/CURRENT_RELEASE_STATUS.md) replaces
the earlier overly broad readiness claim. Staging/device/provider acceptance and
the remaining dependency/chat-protocol work still prevent production certification.

## Completed follow-up repairs

The full backend/website source was retrieved into an isolated checkout and repaired.
The reviewable combined artifact is [platform-hardening.patch](production-fixes/platform-hardening.patch);
[application instructions and remaining acceptance work](production-fixes/PLATFORM_HARDENING.md)
describe its exact scope. Staff/Support roles remain retired, as requested.

Saved searches and optional new-member alerts are also implemented.
[Feature scope and deployment instructions](production-fixes/SAVED_SEARCH_ALERTS.md)
include the separate backend/website patch and required database migration.

[Unconnected profile visibility](production-fixes/UNCONNECTED_DISCOVERY.md) is
also repaired in Search, Discover and the companion backend query.

The contact request/approval feature was removed at the user’s request. Its
mobile components, API client, tests and undeployed backend patch were removed;
the contact details section is now hidden on every profile, including connected
profiles and self previews, as requested. Regression tests cover both cases.

Current verification supersedes the original snapshot below:

| Area | Result |
| --- | --- |
| Mobile | TypeScript passed; 72 suites / 403 tests passed; 0 lint errors; security checks passed |
| Local Django modules | 48 tests passed; schema generation validates without warnings; Python dependency audit has 0 findings |
| Full production backend source | 290 passed / 1 PostgreSQL-only skipped; 29 additional notification tests passed; migration consistency passed |
| Website | TypeScript, strict lint, 46 tests and production build passed; production dependency audit has 0 findings |
| Android | Signed release APK and AAB built; APK/AAB signatures verified; duplicate font packaging fixed |
| iOS | Unsigned arm64 simulator build passed; signed physical-device acceptance still required |

Additional repairs cover the actual settings wire contract and rejected saves,
account-switch preference races, native/browser auth responses, post-trial server
errors, image resource limits, missing OTP templates, retired-role exposure and
Admin lookup errors, deletion audit metadata, audited message visibility, public
deletion/policy routes, safe website redirects and dependency upgrades. Local
Celery beat now schedules retryable session notices. The local Python environment
was recreated with Python 3.12 and Django 5.2.18.

Prior baseline Android artifacts (before the saved-search feature):

- `android/app/build/outputs/apk/release/app-release.apk`: SHA-256 `981c247cec8a9bf7d9bc49afab6e4cc17efe855fc0f65240502d96f7d2042005`.
- `android/app/build/outputs/bundle/release/app-release.aab`: SHA-256 `ae43c4108b60fb2505cc6136e1fa76577140c4053d77f7397167e1f87cc75e7b`.

The AAB signer is self-signed, as expected for an upload key; its registration still
requires Play Console verification. No production deployment, store upload or
live account modification was performed. Provider/device/staging acceptance and
the legacy chat protocol migration remain open; these are not certified by unit tests.

## Original review snapshot

## Scope

Reviewed this checkout's React Native app, Node matching gateway, Django payment/safety/session modules, database routing, dependency audit, release preflight and selected public production routes. The full production Django authentication/profile/chat backend and web source are not in this checkout. No production deployment or authenticated production mutation was performed.

## Changes

- Retained the verified Android native splash fix: padded logo for Android's circular splash mask, used by Android 12+ and 15+ themes. The debug APK was built, installed and its cold launch visually checked on the Android emulator.
- Upgraded transitive `launch-editor` from 2.14.1 to 2.14.2 via an override; its three reported advisories no longer appear in the dependency audit.
- Decoded URL-encoded PostgreSQL usernames, passwords and database names correctly.
- Routed authentication/session, payment, membership and safety reads to the primary database, plus reads inside primary transactions. Replica lag must not resurrect revoked sessions or return stale permissions/payment state.
- Disabled PostgreSQL server-side cursors for the supplied PgBouncer transaction-pooling stack. See [Django's transaction-pooling guidance](https://docs.djangoproject.com/en/5.2/ref/databases/#transaction-pooling-and-server-side-cursors).
- Replaced PgBouncer `AUTH_TYPE: any` with `scram-sha-256` and bound host API/pooler ports to localhost. See [PgBouncer authentication configuration](https://www.pgbouncer.org/config).
- Enabled secure-only session/CSRF cookies in production and Django frame-protection middleware.

## Validation

| Check | Result |
| --- | --- |
| Mobile TypeScript | Passed |
| Mobile ESLint | 0 errors; 238 warnings, mostly style warnings |
| Mobile Jest | 70 suites, 365 tests passed |
| Local security-tool regressions | Passed |
| Node matching build/tests | 13 tests passed |
| Django module tests | 45 tests passed, including added database regressions |
| Django pending model migrations | No changes detected |
| Node production dependency audit | 0 reported vulnerabilities |
| App production dependency audit | 24 high package findings remain through the braces advisory; local patch regressions pass, audit remains nonzero |
| Release configuration preflight | Incomplete: local staging/account/payment/deployment configuration absent |

At the initial review, `server/.venv-release` referenced a missing Python executable (repaired in the follow-up above). Django checks used an isolated Python 3.12 environment in `/tmp/mdp-django-audit-venv`, installed from `server/requirements.txt`. Recreate a project virtual environment with a working Python 3.10+ installation for ongoing development. Docker is unavailable in this shell, so actual PostgreSQL/PgBouncer authentication, replica behavior and Compose startup still need integration testing. SQLite module tests do not establish those behaviors.

The initial Django deploy check reported schema annotations and HTTPS configuration gaps. Those have been repaired. Subdomain-wide HSTS and preload remain deliberately disabled until the real deployment boundary is verified. Verify redirects and HSTS at the real reverse proxy; do not enable forwarded-header trust without checking the proxy boundary.

## Public production observations

Read-only requests to `https://mydearpartner.in` during this review:

| Route | Result | Interpretation |
| --- | --- | --- |
| `/api/v1/auth/me/` | 401 JSON | Anonymous access denied; login itself untested |
| `/api/v1/settings/` | 401 JSON | Requires authentication; persistence untested |
| `/api/v1/member-auth/privacy-settings/` | 401 JSON | Actual mobile privacy route requires authentication; enforcement untested |
| `/api/v1/matches/capabilities/` | 404 JSON | Matching gateway unavailable at the configured public route |
| `/account-deletion/` | Redirect followed by 404 | Checked public deletion URL unavailable |
| `/policies/privacy/` | Redirect followed by 404 | Checked public privacy URL unavailable |

401 responses establish anonymous denial only, not feature correctness. Verify the URLs declared in store listings against the actual hosted pages.

## Requirements still needed for release

1. Dedicated HTTPS staging environment, two disposable member accounts and access to the complete production/backend/web source. Configure `release/.env.acceptance.local` from `release/.env.example`; run `node scripts/release-preflight.cjs` without placing secrets in chat or source control.
2. Matching gateway routing behind the existing HTTPS proxy and server-only provider configuration if AI insights are enabled. Preserve existing authentication/profile/chat routes.
3. Hosted public privacy and deletion pages, verified support contact, and an end-to-end deletion test covering revocation, cleanup workers and retention behavior.
4. Authenticated settings/privacy persistence, account switching, profile visibility and blocked-member enforcement tests.
5. Two-client chat tests, reconnect/retry/unconnect tests, and mobile/web encryption protocol verification. Legacy public-ID-derived message keys remain a confidentiality limitation; local app changes cannot safely replace the shared protocol alone.
6. Razorpay sandbox keys/webhook configuration; verify cancel/failure/success, signature checks, duplicate webhooks and membership fulfillment using test accounts.
7. Physical Android/iPhone tests for push foreground/background/terminated delivery, permissions, deep links, uploads, camera/selfie capture and account restoration.
8. Apple signing/provisioning and an installed signed archive; Android upload certificate/Play Console validation and fresh signed release APK/AAB after these changes.
9. Staging PostgreSQL/PgBouncer startup and password-denial checks, backup/restore verification, worker/beat operation, monitoring and realistic load tests. Replica routing does not implement outage failover.
10. Upstream resolution or reviewed exposure treatment of the remaining braces advisory; passing mitigation tests does not make the dependency audit clean.

This review establishes local check results and the observed public responses. It does not certify production readiness, store approval, payment fulfillment or capacity.
