# Upgrade implementation — 2026-09-30

## Completed locally

- Payment webhook failures remain retryable; successful processing is transactional and duplicate activation is prevented. Different payment events retain distinct identities, and late failure notifications cannot downgrade paid orders.
- Invalid payment plan IDs return validation errors. Membership responses check expiration immediately.
- Daily allowance storage and caches are account-specific. Finite and zero server entitlements are respected.
- Uploads refresh expired credentials once and retry. A delayed rejected refresh cannot clear a newer login's credentials.
- Only explicit interest quota errors mark the daily allowance exhausted. Compare opens existing matches, accepts incoming interests, and withdraws outgoing interests appropriately.
- Removed four unsupported search filter controls and two inactive quick prompts rather than presenting selections that do nothing. Existing working filters and reset controls remain. The 90% prompt now applies a 90% threshold.
- Fixed notification day calculations, unsupported StatusBar props, and the stale profile-save test mock.
- Removed local mock eligibility approval. Missing or failing endpoints no longer grant access.
- Profile normalization preserves server photo IDs. Removal now calls the deletion endpoint and changes the gallery only after success. URL-only photo responses show an explanation instead of pretending deletion succeeded.
- Discover cards are shorter, reserve room above floating navigation, show photo loading/unavailable states, and explain the source/limitations of the displayed score.

## Validation

- `npm run check -- --watchman=false`: TypeScript passed; ESLint passed with 197 warnings and zero errors; 34 Jest suites / 118 tests passed.
- After the final storage-error handling adjustment: all four allowance regression tests passed again.
- Django: 20 tests passed, including six new payment regressions.
- Android `./gradlew assembleDebug`: successful. Debug APK installed and launched on emulator-5554.
- Emulator launch reached the eligibility screen and displayed “Unable to check account eligibility.” No consent, personal date of birth, payment, or other production data was submitted during the smoke test.

## Outstanding dependencies and limits

1. **Eligibility API deployment is blocking authenticated app access.** The new fail-closed behavior exposes the existing server failure. Deploy/integrate the local `server/safety` implementation with the actual production backend and verify its authenticated GET/POST contract before releasing this mobile update. The failing emulator check does not establish its exact HTTP status.
2. **Photo deletion requires stable IDs and a working delete endpoint.** The app supports IDs in gallery objects and a primary `photo_id`. Legacy URL-only responses need backend changes; the mobile app does not guess IDs from filenames or array positions.
3. **Payment fixes are local.** Production deployment and real checkout/webhook validation have not been performed. PostgreSQL concurrent delivery behavior was not exercised; local regressions used SQLite.
4. **Encryption redesign is outstanding.** Existing chat keys still derive from public IDs. A coordinated versioned protocol, private key storage/exchange, web/mobile/extension support, and historical-message migration are required. Changing only this client would break interoperability and message readability.
5. **Device coverage is limited.** Android launch was observed; authenticated Discover visuals remain blocked by eligibility. No iOS build, physical-device push/camera tests, or real two-account chat/payment flows were completed.

The earlier `FUNCTION_REVIEW_REPORT.md` records the pre-fix findings. This document describes the implementation and current limitations.
