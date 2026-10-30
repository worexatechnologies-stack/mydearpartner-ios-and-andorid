# Rollback preparation — 23 October 2026

Status: **BLOCKED for operational acceptance**. This is a reviewable plan; no
deployment, database backup/restore, rollback or store submission was executed.

Before an approved release:

1. Record the exact mobile/backend/web revisions, patch hashes, environment
   identifiers, deployed image digests, migration state and worker/beat versions.
   The local audit records candidate hashes in
   `scratch/release-audit-2026-10-23/source-manifest.json` and
   `android-artifact-validation.json`.
2. Preserve the current known-good signed binaries and backend/web images in
   the operator's artifact store. The new APK/AAB audit copies are candidates,
   not a proven rollback baseline. Verify the Android upload certificate against
   Play Console and the iOS distribution identity/profile before submission.
3. Take a protected staging database/media backup and actually restore it to a
   separate database. Verify profile photos, chat history, private document
   access, memberships and deletion/audit records. Record duration and approved
   recovery objectives. Do not print credentials or member data in evidence.
4. Review every migration for compatibility with both old and new services.
   Profile-state and saved-search changes add schema; do not reverse migrations
   blindly or delete columns during a rollback. Rehearse restoring the previous
   service against the migrated staging schema.
5. Exercise rollback on staging with test accounts: restore prior service/web
   images, coordinate workers and beat, check health/authentication, private-data
   authorization, chat, notification retries and idempotent payment fulfillment.

For an approved production rollout, use a staged store rollout and the existing
deployment pipeline. Monitor crashes/ANRs, authentication errors, message
delivery, webhook failures, push failures and queue depth against agreed limits.
The operator must name the person authorized to halt or roll back the rollout.

On a release regression, halt distribution, preserve incident evidence and use
the rehearsed compatible backend/web rollback. Keep payment webhooks and account
deletion processing consistent across worker versions; reconcile events by their
existing idempotency identifiers. Users cannot generally downgrade an installed
mobile build through the stores, so a mobile repair normally requires a new
signed build with a higher build number. Do not rotate or replace signing keys
as an improvised rollback.

All production commands, restore operations and store actions remain subject to
explicit user approval. Missing staging access, known-good artifacts, signed iOS
distribution and a tested backup/restore prevent marking this gate complete.
