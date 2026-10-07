# Google Play policy remediation — 28 September 2026

## Release status

The app and local Django source now implement policy viewing, report intake, account-deletion requests, public policy/deletion pages, adult eligibility and periodic policy acceptance. These changes are **not deployed**. They do not establish production compliance on their own.

**Deploy and verify the safety backend before releasing this app.** Eligibility intentionally fails closed: missing endpoints, failed authentication or unavailable eligibility checks prevent access to profiles and chat. Login, policy viewing, deletion requests and sign-out remain accessible. Do not remove the check to work around a missing production integration.

The production Django registration/profile/chat implementation is not in this repository. `server/` currently supplies payments and the new safety app; `backend/` is an Express health-check scaffold. Do not replace the production service with either scaffold. Integrate `server/safety/` into the existing service and use its existing user model and JWT authentication.

## Implemented

- Signup has functional Terms, Privacy and Community & Child Safety views, a real calendar-date check and an 18+ requirement. The registration payload includes birth date and policy version.
- Existing and new authenticated users must receive server-confirmed eligibility before `AppDataProvider` and the member navigation mount. Acceptance expires after 90 days and is checked again when the app returns to the foreground. The backend prevents changing the recorded birth date through self-service attestation.
- Profiles/photos, conversations and individual incoming messages can be reported. Only target identifiers and explicitly entered report details are submitted; decrypted message text is not automatically shared. Report submission requires consent and a real server receipt.
- Blocking remains available separately. The Django admin queue prioritizes child safety, underage, intimate-content and threat reports.
- Settings and the eligibility screen allow a confirmed account-and-data deletion request. Requests are persisted and deduplicated while pending. Submission does not falsely claim deletion or deactivate an account.
- The public deletion form works without an app login, is CSRF-protected, rate-limited, and never deletes an account based solely on an unverified email address.
- Broad Android image/video/storage permissions are explicitly removed during manifest merging. Uploads continue using the system image picker. Selfie capture requests runtime camera permission. Verification uploads explain purpose and deletion access.

## Production integration required

1. Add `safety` to the production Django `INSTALLED_APPS`. Copy its templates, `legal.json`, migrations and routes. Run `python manage.py migrate` against the intended environment after normal backup/release procedures. No production migration was run here.
2. Mount `safety.urls` under `/api/v1/`. Public routes are `/policies/privacy/`, `/policies/terms/`, `/policies/safety/` and `/account-deletion/`. Test these with no login on the real domain.
3. Apply `AdultMember` alongside authentication to **every** production discovery, profile, upload, interest, matching and messaging endpoint. Views with explicit `permission_classes` override DRF defaults. Apply equivalent checks to WebSocket connect/send paths. Safety, deletion, authentication, logout and the member's own eligibility endpoint must remain accessible to ineligible users. The local defaults and new payment-order endpoint already use this permission.
4. Integrate `EligibilitySerializer` validation into the production registration transaction. Persist accepted birth date, version and acceptance time. Keep profile age consistent with the verified account birth date; prevent profile updates from bypassing the age restriction. The in-app attestation is self-declared age, not identity or age verification.
5. Resolve report target identifiers against production profiles/chat membership before staff action. Staff must have controlled access to the relevant content and enforcement tools. Never automatically penalize an account solely because a report was submitted.
6. Give the designated safety team access to the admin queue and monitor it. Establish urgent escalation, content removal, account restriction, appeals, and legally required reporting to the appropriate authority. The queue does not itself remove production content or notify authorities.
7. Fulfil deletion requests through the production data model and storage: profile, photos, verification uploads, message records, interests, notification/device tokens, credentials, sessions and external processors as applicable. Verify public-form ownership through the established authenticated/email process. Revoke access, remove associated data, record justified retention exceptions, and notify the requester. Mark a queue entry completed only after those actions are actually done. The admin status field does **not** perform deletion.
8. Configure shared-cache/edge rate limiting for public forms in a multi-worker deployment; the default local Django cache is per process. Protect the staff admin with appropriate production access controls.

## Policy text and operational decisions

`src/config/legal.json` and `server/safety/legal.json` are matching proposed policy texts; a test checks they stay identical. The app name and existing `support@mydearpartner.in` address are used. Confirm the operating business name, that this mailbox is monitored for privacy/child-safety/grievances, actual third-party processing, and retention periods before publishing. Replace/generalize any practice that the operator cannot substantiate. In particular, settle deletion completion time, verification-document retention, safety-report retention, financial/legal exceptions and backup deletion schedules; these cannot be inferred from the available code.

Do not claim this code review is a legal assessment of the Indian IT Rules. Have the operator assess the applicable intermediary category, grievance contact requirements, lawful response deadlines, synthetic-content obligations and authority-reporting procedures against the current rules.

## Alternative billing — awaiting program details

The owner confirmed existing enrollment in an alternative-billing program. Enrollment alone does not identify the required checkout implementation. **The existing Razorpay checkout has not been certified or replaced by this safety change.** Confirm the exact program and enrolled countries before changing the payment flow.

- User choice billing: integrate Google's choice flow and support both Google Play purchases and Razorpay; persist Google's external transaction token before starting the Razorpay transaction, and implement the applicable server reporting/reconciliation.
- Alternative billing only: use that program's availability check, required information dialog, reporting token and server reporting. Do not substitute it for a user-choice enrollment.
- Test on a Play-distributed build with eligible/ineligible country accounts, cancellations, pending purchases, retries, refunds and duplicate notifications. The developer account's product configuration and reporting credentials are not present here.

## Play Console and release validation

- Set the applicable adult audience/content rating and enable Restrict Minor Access for matchmaking.
- Publish the privacy and account-deletion URLs and the child-safety standards URL; designate the required child-safety contact and complete the relevant declarations.
- Reconcile Data safety declarations with actual production collection, processing, retention and SDK behavior, including identity/income documents, selfies, messages, profile information, push tokens and payments.
- Verify the merged release manifest no longer includes broad photo/video permissions, including all active submission tracks. Test gallery selection and camera permission denial/grant on physical Android devices.
- Run authenticated production end-to-end checks for reports, blocking, deletion and eligibility. Exercise staff handling and confirm real deletion/storage cleanup rather than just a successful HTTP response.
- Verify release bundle contents match this source; existing APK/AAB artifacts were not rebuilt or published by these changes.

## Verification performed

- TypeScript: `npm run typecheck` passed.
- App tests: `npm test -- --runInBand --watchman=false` passed, 86 tests across 29 suites. Watchman was disabled because its state directory is outside the sandbox.
- Backend tests: `python server/manage.py test safety payments` passed, 14 tests, using the existing `/private/tmp/mdp-safety-venv` environment.
- Django migration consistency: `makemigrations --check --dry-run` passed.
- Android: `:app:processReleaseMainManifest --offline` passed. The generated release manifest has no `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` or `READ_EXTERNAL_STORAGE` permission.
- ESLint reports no errors; warnings remain. No production deployment, physical-device flow test, signed APK/AAB rebuild, or Play Console change was performed.

## Policy sources

- [User data and privacy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en)
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)
- [User-generated content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
- [Child-safety standards](https://support.google.com/googleplay/android-developer/answer/14747720?hl=en)
- [Minor-access restrictions](https://support.google.com/googleplay/android-developer/answer/16838200?hl=en)
- [Photo permissions](https://support.google.com/googleplay/android-developer/answer/14115180?hl=en)
- [Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en)
- [User choice integration](https://developer.android.com/google/play/billing/alternative/alternative-billing-with-user-choice-in-app)
- [Alternative-only integration](https://developer.android.com/google/play/billing/alternative/alternative-billing-without-user-choice-in-app)
- [Indian IT Rules amendment, February 2026](https://www.meity.gov.in/static/uploads/2026/02/f55fe52418b03f58b0669f6a8bc03b6d.pdf)
