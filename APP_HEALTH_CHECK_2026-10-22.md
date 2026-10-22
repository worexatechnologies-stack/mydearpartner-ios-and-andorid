# App health review — 22 October 2026

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

The existing `server/.venv-release` references a missing Python executable. Django checks used an isolated Python 3.12 environment in `/tmp/mdp-django-audit-venv`, installed from `server/requirements.txt`. Recreate a project virtual environment with a working Python 3.10+ installation for ongoing development. Docker is unavailable in this shell, so actual PostgreSQL/PgBouncer authentication, replica behavior and Compose startup still need integration testing. SQLite module tests do not establish those behaviors.

The production-mode Django deploy check still reports API schema annotations/authentication-extension warnings and missing application-level HSTS/HTTPS redirect settings. Verify redirects and HSTS at the real reverse proxy; do not enable forwarded-header trust without checking the proxy boundary.

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
