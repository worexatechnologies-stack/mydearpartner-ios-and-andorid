# Release fixes — 6 October 2026

Status: **Not ready for public release.** The fixes below are implemented locally. Production has not been updated or certified.

## Source locations

- Mobile: this repository.
- Full Django and Next.js: `../backend-notification-fix/backend` and `../backend-notification-fix/frontend`, from the supplied GitHub repository. The mobile repository's `server/` and Express `backend/` are partial services, not substitutes for the complete backend.
- Existing workspace changes were preserved. No commit, push, deployment, live payment or store publication was performed.

## Implemented fixes

- Save Profile: the shared button places its gradient behind a normal layout container. The label is centered without clipping; visually checked in the iOS simulator.
- Adult eligibility: the standalone gate received foreground and stale-request fixes, then was removed from startup at the user’s explicit request. The removed screen remains removed. Signup sends explicit consent, DOB and the current policy version; the backend records eligibility atomically and uses server consent timestamps. Django enforces eligibility on member APIs and incoming chat events, and prevents changing an attested date of birth. The picker now aligns the selected date correctly.
- Chat: new mobile/web sends require the server-managed security contract. Each conversation has a random key; messages use authenticated encryption at rest. Authorized server moderation access is retained, as requested. Predictable public-ID encryption is used only for decoding old history, not for new encryption. Push notifications omit message content. Migration and wrapping-key rotation commands default to dry runs. Privileged retained-message search decrypts a bounded set after authorization/audit.
- Mobile settings: server endpoints persist privacy and notification preferences; notification delivery honors those preferences.
- Verification: uploads use private document storage and human review. Status is account-scoped; uploads are not automatically approved. The mobile screen now shows fetch errors and retry, and removes its fabricated trust score.
- Authentication: native clients identify themselves and receive tokens for Keychain. Browser member login uses HttpOnly cookies, and refresh keeps the refresh token out of JSON. Browser fetch headers override a spoofed native hint. This hint selects response format; it is not an authorization boundary.
- Additional fixes: corrected the local Compose volume declaration; added the web `/safety` policy page; enabled permission-checked Admin review escalation; persisted deletion audits and metadata for both administrator and scheduled cleanup.
- Backend: upgraded Django to 5.2.17 and DRF to 3.18.1; strengthened production secret checks; added the missing OTP email template; removed detailed login-failure reasons; unsigned payment webhooks return a client error.
- Web: upgraded Next.js/Firebase and affected dependencies, corrected internal navigation, and verified the production build.
- Tool dependencies: upgraded affected transitive packages, adapted Metro to image-size 2, and patched recursive braces processing with depth/cycle limits. Patch application fails installation if a patch cannot apply. Regression checks cover malicious nested glob inputs and malformed image metadata.

## Verification

- Mobile: TypeScript passes; lint has zero errors (218 warnings); **47 suites / 211 tests pass**; security tool regressions pass.
- Web: lint/typecheck pass; **34 tests pass**; Next.js production build passes.
- Partial local Django service: **26 tests pass** on the upgraded Python/dependency environment.
- Complete Django: migration consistency and system checks pass. The complete suite now has **278 passed, 1 skipped, zero failures or setup errors**. Tests for retired Staff/Support workflows were replaced with current-role authorization, administrative lifecycle, private support notes and review coverage, as requested. Counts are not directly comparable to the old suite.
- An iOS release JavaScript bundle was generated successfully. This does not establish that signed Android/iOS binaries include every later change or pass physical-device testing.
- npm audit still reports **54 high findings for mobile and 7 high findings for web**, all propagated from the braces advisory. The installed version is locally patched and regression-tested; the version-based advisory remains visible. There are no critical/moderate findings in these final audits. A clean registry audit is not claimed.

The untouched upstream baseline already failed its complete backend suite: **25 failures, 35 setup errors, 209 passed, 1 skipped**. Those failures have now been reconciled with the current three-role product. Actual defects fixed include Admin account lookup targeting the old Staff table, expired-trial fallback raising duplicate-keyword errors, and missing permanent-deletion audit/metadata persistence. Test fixtures now explicitly model trial expiry, mobile verification, plan photo limits and ciphertext storage. Retired role tests were replaced rather than skipped.

## Required rollout and remaining acceptance

1. Supply a staging URL and use staging accounts/provider sandbox credentials through the normal secure environment configuration. No staging URL was supplied in this session.
2. Use supported Python (3.10+; these backend checks used 3.14). Recreate old Python 3.9 virtual environments rather than reusing them. Install backend requirements and run migrations, including member settings and conversation wrapping-key fields. Run production configuration checks with the deployment environment, not test settings.
3. Back up the database and wrapping secrets. Deploy the backend reader/security contract before the updated mobile/web senders. Check that existing members can attest their recorded adult DOB; resolve incorrect records through the appropriate support process.
4. Run `python manage.py encrypt_retained_messages` as a dry run, inspect skipped orphan messages and decide how to handle them before claiming all retained history is protected. Apply with `--apply` in a controlled deployment and verify authorized history/moderation access. Do not roll back to a reader that cannot decode the new storage prefix.
5. Preserve wrapping secrets securely. For secret rotation, retain the old secret in `SECRET_KEY_FALLBACKS`, run `rotate_chat_wrapping_keys` dry run then `--apply`, verify all keys, then remove the old fallback. Losing all applicable secrets makes retained messages unreadable.
6. Run the current complete backend suite in deployment CI; it passes locally. Dedicated adult-gate tests enable enforcement; the legacy test settings disable it for existing fixtures. Production enforcement defaults on. Existing members without current policy acceptance must consent explicitly; no historical acceptance was manufactured.
7. Perform staging and physical-device acceptance: registration/password/OTP/login/refresh/logout, adult gate, profile save/photos, private verification review, two-account interests/chat/history/blocking/reporting, moderation audit, background APNs/FCM, sandbox payment/webhook/retry, account deletion and policy pages. Validate secure media permissions and operational backup/monitoring configuration.
8. Produce fresh signed native release artifacts from the verified revision and test them before store/public release. Existing APK/AAB files in the workspace are not evidence that these changes were packaged.

Final logs: `/tmp/mdp-release-final-mobile-check3.log`, `/tmp/mdp-release-final-backend-targeted3.log`, `/tmp/mdp-release-final-full-backend-tests2.log`, and `/tmp/mdp-release-web-final-{lint,typecheck,tests,build}2.log`. These temporary logs are not durable CI evidence; preserve CI results with the eventual reviewed release revision.


Final remediation logs: `/tmp/mdp-release-final-complete-tests2.log` (278 backend tests), `/tmp/mdp-release-final-complete-mobile.log` (211 mobile tests), `/tmp/mdp-release-final-web-tests.log` (34 web tests), `/tmp/mdp-release-final-web-build3.log`, `/tmp/mdp-release-final-web-lint3.log`, and `/tmp/mdp-release-final-migration-consistency.log`. Live deployment remains blocked by rejected SSH authentication.


### Native release execution

Fresh signed Android APK/AAB builds now pass using cached dependencies; see [RELEASE_EXECUTION.md](RELEASE_EXECUTION.md) for artifact paths, hashes, signature findings and deployment/signing blockers. The iOS Release extension team was aligned with the main app’s Release team. Store submission and physical-device acceptance remain incomplete.
