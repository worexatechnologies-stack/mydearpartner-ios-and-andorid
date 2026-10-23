# Backend and website repairs — 22 October 2026

`platform-hardening.patch` targets the complete website/backend repository at
`170514b2d56214b7e0a63982e7519df8e2d14422`:
https://github.com/worexatechnologies-stack/My-dear-partner-project-by-worexa

This combined patch includes the existing profile-state synchronization and chat
notification reliability patches. Apply this combined patch instead of applying
those two patches separately. The mobile app changes are already in this app
checkout. No production deployment or GitHub push was performed.

## Repairs

- Preserve native bearer-token responses consistently for registration, login,
  recovery, refresh and OTP login; browser responses use HttpOnly cookies and
  omit bearer tokens. Authentication responses are marked `no-store`.
- Validate account/privacy settings before writes, decode booleans correctly,
  reject invalid visibility values, serialize concurrent settings writes and
  publish member-specific settings refresh events after commit.
- Keep Staff/Support roles retired, as requested. Block retired API paths, exclude
  retained Staff rows from active account listings and fix duplicate Admin lookup
  mappings that incorrectly selected the legacy Staff table. Replace retired-role
  workflow tests with denial tests, while retaining Admin permission coverage.
- Correct the post-trial Free entitlement fallback, which previously passed
  duplicate constructor arguments and returned server errors.
- Restore bounded profile image processing (10 MB uploads, 40 million decoded
  pixels), check dimensions before decoding and preserve the explicit legacy
  backfill exception for minimum dimensions. Add the missing OTP email template
  and ensure Git tracks it.
- Persist permanent-cleanup audit metadata, without retaining document binaries.
  Restore retained message visibility only in the existing audited Super Admin
  path; ordinary members still see the deleted-message placeholder.
- Handle Celery beat's generated singleton correctly during isolated database
  reset verification. No reset command was run against a live database.
- Add a public account-deletion information page, policy URL redirects and Staff
  URL redirects to the supported Admin portal.
- Reject external post-login return URLs and unsafe notification navigation.
- Upgrade Django/DRF, Daphne, Pillow, Next.js and affected transitive dependencies;
  add the tested braces mitigation and regression checks to the website.
- Pin the backend test dependencies and align obsolete tests with current trial,
  membership, verification and account-lifecycle contracts.

## Validation

- Full backend: **275 passed, 1 skipped**. The skipped case requires an explicitly
  configured PostgreSQL integration database. SQLite does not verify PostgreSQL
  locking or deployment behavior.
- Separate notification suite: **29 passed**, with Firebase mocked.
- Backend migration consistency: **no changes detected** beyond the included
  state migration.
- Website: TypeScript and strict ESLint passed; **42 tests passed**; production
  build passed; braces mitigation regressions passed.
- Website production dependency audit: **0 findings**. The complete development
  audit still reports the braces chain despite the verified local mitigation.
- Production Python dependency audit: one remaining Twisted IMAP advisory,
  `CVE-2026-106454`, with no fixed release reported. This application uses Daphne
  HTTP/WebSockets and does not run an IMAP service. Keep this distinction in the
  dependency review rather than claiming a completely clean Python audit.
- The combined patch was checked against an unmodified worktree at the base
  commit with `git apply --check`.

## Apply and verify

In the complete backend/website repository, use a clean branch:

```sh
git apply --check /absolute/path/to/platform-hardening.patch
git apply /absolute/path/to/platform-hardening.patch
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements/test.txt
RENFLAIR_API_KEY=local-test-only DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/python -m pytest -q
RENFLAIR_API_KEY=local-test-only DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/python manage.py test apps.notifications.tests --noinput
cd ../frontend
npm ci
npm run typecheck
npm run lint
npm test
npm run security:tools
npm run build
```

The test OTP key is deliberately invalid and is not a production credential.
Account tests stub SMS delivery; notification tests mock Firebase. Install real
provider credentials only in protected deployment configuration.

Deploy through the existing verified deployment workflow, run migrations before
serving updated profile-state requests, and rebuild/restart both backend and
workers plus the website. Preserve the existing authentication/profile/chat
routes when adding the separately prepared matching gateway proxy configuration.

## Mobile build evidence

The app checkout passed 372 tests across 71 suites, TypeScript and security-tool
checks. Lint reports 238 warnings and no errors. The signed Android release APK
and AAB were rebuilt and their signatures verified. The unsigned arm64 iOS
simulator build passed with `CODE_SIGNING_ALLOWED=NO`; this is not a signed IPA.
See [the app health report](../APP_HEALTH_CHECK_2026-10-22.md) for artifact paths
and hashes.

## Remaining release acceptance

Staging credentials, PostgreSQL/Redis integration, physical-device FCM/APNs
delivery, Razorpay sandbox fulfillment, hosted-page checks after deployment,
Apple signing/provisioning, store upload-certificate checks and rollback/load
tests remain external acceptance work. The legacy public-ID chat format is not
a reviewed end-to-end encryption protocol; replacing it requires a coordinated
protocol and history migration. Do not advertise that format as E2EE.
