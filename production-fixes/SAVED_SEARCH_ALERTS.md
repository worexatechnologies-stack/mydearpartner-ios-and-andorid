# Saved searches and new-member alerts

The mobile implementation is in this app checkout. The companion backend and
website changes are in [saved-search-alerts.patch](saved-search-alerts.patch).
This feature has not been deployed to production.

Members can save up to 10 named searches, reopen their paginated results, opt in
to alerts, pause alerts, and delete searches. Alerts default to off. Supported
filters are text search, city, religion, mother tongue, marital status, education,
profession and verified-only. Quick suggestions must be cleared before saving.
Duplicate filters are rejected even when capitalization differs.

A Celery beat sweep runs every 15 minutes. It checks members who joined after the
search was saved, including those approved later. Each search task processes up
to 50 unseen matches, with transaction locking and unique search/member records
to prevent repeated alerts. Larger backlogs continue on the next sweep. Existing
profile eligibility, verification, hiding and both-direction blocking rules apply.

Notifications persist in the member's inbox. Foreground/realtime copies share an
alert ID for deduplication, and taps open that saved search. Browser push links
also open owned, paginated results. Push text does not contain profile details.
The existing Matches notification preference stops new alerts; the general push
preference stops push delivery. Paused or deleted searches suppress queued pushes
when the delivery task starts. A push already accepted by a provider cannot be
recalled. Account changes invalidate pending mobile requests.

## Apply to the full production repository

The patch applies after [platform-hardening.patch](platform-hardening.patch),
which targets repository commit `170514b2d56214b7e0a63982e7519df8e2d14422`.
Do not apply the older individual repair patches as well.

From the root of the complete website/backend repository:

```sh
git apply --check /absolute/path/to/platform-hardening.patch
git apply /absolute/path/to/platform-hardening.patch
git apply --check /absolute/path/to/saved-search-alerts.patch
git apply /absolute/path/to/saved-search-alerts.patch
cd backend
python manage.py migrate
```

If the combined repair is already applied, run only the saved-search patch steps.
Rebuild/restart the backend, Celery worker and Celery beat using the existing
production configuration, and rebuild the website. Deploy the backend and
migration before distributing the new mobile app. Until then the app reports
that saved searches are unavailable when the endpoint returns 404. The app's
small local Express/Django support modules are not the full production backend.

All endpoints are authenticated and member-owned under `/api/v1/`:

- `GET/POST saved-searches/`: list and create.
- `GET/PATCH/DELETE saved-searches/<uuid>/`: read, rename/pause, delete.
- `GET saved-searches/<uuid>/results/`: paginated eligible profiles.
- `GET saved-searches/alerts/`: latest 50 saved-search alerts.
- `PATCH saved-searches/alerts/<uuid>/`: mark an owned alert read.

## Validation

- Mobile: TypeScript, lint (no errors), security regression checks; 72 suites,
  382 tests passed, including opt-in defaults, pause/delete, stale account
  responses, server pagination, notification classification and deduplication.
- Full backend: 286 tests passed, one PostgreSQL-only test skipped; 29 additional
  notification tests passed. Migration consistency check passed. Feature coverage
  includes ownership, validation/caps, eligibility, later approval, preferences,
  bounded processing, pagination and transaction rollback.
- Website: TypeScript, strict lint, 46 tests and production build passed.
- Android signed release APK/AAB and unsigned arm64 iOS simulator builds passed.
  APK/AAB signatures verified.
- Patch application checked against both the repaired baseline and the original
  production commit followed by the combined repair patch.

Provider delivery was mocked. Verify the 15-minute schedule, actual push receipt
and notification taps on dedicated staging accounts after deployment, including
paused searches and account switching. PostgreSQL concurrency acceptance remains
necessary; local backend tests use isolated SQLite databases.

Android artifacts from the saved-search build (superseded by the later
[unconnected discovery correction](UNCONNECTED_DISCOVERY.md)):

- `android/app/build/outputs/apk/release/app-release.apk`: SHA-256
  `05f51c358f190e7bb8979a8b0e8c0a1a92069c5f7d46443086613ac359b9a2d9`.
- `android/app/build/outputs/bundle/release/app-release.aab`: SHA-256
  `9c258328db7fa410c4f71ef2cf780db5c02a90edd8175e6723cb1894e90af049`.
