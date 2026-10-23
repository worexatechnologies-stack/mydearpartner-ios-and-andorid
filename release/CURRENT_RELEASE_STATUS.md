# Release status — 22 October 2026

**Production acceptance is incomplete.** Successful local tests and signed Android
artifacts do not establish live readiness. The current verification is recorded
in [the full app test report](../FULL_APP_TEST_2026-10-22.md).

Verified locally: 418 mobile tests, 48 supplementary Django tests, 13 gateway tests,
290 prepared-backend tests (one PostgreSQL-only skip), 29 targeted notification
tests and 46 website tests pass. Android signed APK/AAB builds and the unsigned
iOS Release arm64 simulator build succeed. Android lint has 0 errors / 24 warnings;
mobile lint has 0 errors / 244 warnings. APK signature verification passes; AAB
verification reports `jar verified` with certificate and manifest-order warnings.
Play validation remains outstanding.

## Repairs from this readiness pass

- Android update/rating links use `com.mydearpartner`, matching the native app.
- App configuration accepts only official HTTPS store links for the current
  platform. iOS requires a real numeric Apple listing ID from `update_url` or
  `store_url`; the previous placeholder is removed.
- Mandatory updates use a persistent modal. Opening the store or pressing
  Android Back does not dismiss it. Store failures expose a retry action.
- Malformed version configuration and endpoint outages do not crash startup.
- The runtime version comes from package.json. The release bump also updates
  package-lock.json, preserving npm ci compatibility.
- A failed rating-store launch does not mark the member as having rated.
- CI runs all Django modules, including account sessions, and executes the
  matching gateway tests rather than only compiling it.

## Outstanding release requirements

1. Configure dedicated HTTPS staging and two disposable accounts in the ignored
   `release/.env.acceptance.local`, using `.env.example` as a template. Local
   preflight currently reports the acceptance configuration missing.
2. Integrate and deploy the prepared full-backend/website patches through that
   repository's deployment process, including migrations and worker/beat changes.
   This checkout's `server/` is a supplementary service; it must not replace the
   complete live authentication/profile/chat backend.
3. Verify real OTP/recovery, privacy persistence, account deletion, two-account
   chat/reconnection, uploads, and Android/iPhone push states on staging.
4. Verify Razorpay sandbox checkout and signed, duplicate webhook fulfillment.
5. Supply and verify the actual iOS App Store URL. Complete Apple signing,
   archive/export and physical iPhone acceptance. Verify the Android upload
   certificate in Play Console and install the current signed release on a
   dedicated device without deleting existing member data.
6. Resolve or formally review the remaining 24 high npm audit findings. Local
   security mitigation regressions pass; npm audit remains nonzero.
7. Finish the shared chat cryptography migration, PostgreSQL/PgBouncer integration,
   backup/restore, monitoring and staging load acceptance described in
   [the health review](../APP_HEALTH_CHECK_2026-10-22.md).

No production deployment, store submission, purchase or member mutation was
performed as part of this pass.
