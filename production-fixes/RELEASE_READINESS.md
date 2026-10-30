# Release audit repairs — 23 October 2026

`release-readiness.patch` belongs to the complete backend/website repository,
not this app's supplementary `server/` or Express gateway. It is prepared against
commit `170514b2d56214b7e0a63982e7519df8e2d14422`, after these patches in order:

1. `platform-hardening.patch`
2. `unconnected-discovery.patch`
3. `saved-search-alerts.patch`
4. `release-readiness.patch`

All four patches were checked and applied in that order to a fresh local clone.
No remote repository, deployed service or database was changed.

The new patch:

- Rejects an invalid `DJANGO_ENV` instead of silently selecting local defaults.
- Requires test Razorpay mode and test keys on staging/local; production still
  requires live mode and live keys. This permits sandbox acceptance without
  making staging capable of charging real money.
- Upgrades Django REST Framework from 3.18.1 to 3.18.2, addressing
  CVE-2026-114136, CVE-2026-114137 and CVE-2026-114138.
- Fixes the website ticket search timer's browser/Node TypeScript mismatch.
- Adds eight environment isolation cases and six JSON parser cases. The parser
  tests reject non-text/decompression charsets while retaining UTF-8 support.

Verification: 304 full-backend pytest cases passed, one PostgreSQL-only case
skipped; 29 notification tests passed with provider sends mocked; ordinary
Django checks and migration consistency passed. The website passed TypeScript,
strict lint, 46 tests, security-tool checks and its production build.

The full production dependency audit still reports the unfixed Twisted IMAP
advisory CVE-2026-106454. This app uses Daphne HTTP/WebSockets; no IMAP server is
configured in the reviewed source. That reachability assessment is not an audit
waiver or a claim of zero findings. Full `check --deploy --fail-level WARNING`
also reports schema-generation warnings; the separate security-tagged deploy
check passes with synthetic configuration. Neither checks the deployed secrets
or services.

From a reviewed clone, check each patch before applying it, then run:

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements/test.txt
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/python -m pytest -q
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/python manage.py test apps.notifications.tests apps.notifications.test_presence_subscriptions --noinput
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test .venv/bin/python manage.py makemigrations --check --dry-run
cd ../frontend
NEXT_TELEMETRY_DISABLED=1 npm ci
npm run typecheck
npm run lint
npm test
npm run security:tools
NEXT_TELEMETRY_DISABLED=1 npm run build
```

The OTP key above is intentionally invalid. Tests mock provider delivery. Actual
OTP, push, payment, PostgreSQL, worker, retention and rollback acceptance require
isolated staging infrastructure and protected credentials. Integration and
deployment require a separate approval; the release remains **NOT READY**.
