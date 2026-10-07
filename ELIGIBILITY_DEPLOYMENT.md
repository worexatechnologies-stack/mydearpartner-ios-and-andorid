# Eligibility endpoint deployment

**Current mobile behavior:** At the user’s request, the eligibility screen has been removed from startup by unmounting `EligibilityBoundary` in `App.tsx`. Normal navigation now opens directly. This does not create server acceptance records or change backend eligibility enforcement. The live endpoint remains unavailable until deployment.

The integration is applied locally to `../backend-notification-fix`:

- `backend/config/settings/base.py`: registers `safety.apps.SafetyConfig`.
- `backend/config/urls.py`: mounts `safety.urls` at `/api/v1/`.
- `backend/safety/`: persistence, migration, validation, policy version, and authenticated member endpoints.
- `backend/apps/accounts/tests/test_eligibility_api.py`: integration regressions against the actual member model, response renderer, and JWT authentication.

`ELIGIBILITY_BACKEND.patch` is an older endpoint-only snapshot and does not contain the current DOB immutability checks or full release remediation. Use the reviewed current source in `../backend-notification-fix` with the rollout described in [RELEASE_FIXES.md](RELEASE_FIXES.md). Do not deploy that old patch as the complete fix.

## Server steps

The repository's `deploy.sh` documents `/opt/mydearpartner/backend`, the `venv` environment, `config.settings.production`, and service `mydearpartner-backend`. Confirm those against the running deployment; read-only SSH access to the documented host was rejected in this session.

After applying the patch to the deployment source and taking the normal database backup:

```sh
cd /opt/mydearpartner/backend
venv/bin/python manage.py check --settings=config.settings.production
venv/bin/python manage.py migrate --plan --settings=config.settings.production
venv/bin/python manage.py migrate --settings=config.settings.production
sudo systemctl restart mydearpartner-backend
```

Review the migration plan and back up the database before applying the current release migrations. Do not run the broad `deploy.sh` just for this fix: it also synchronizes unrelated files and changes system configuration.

Verify unauthenticated GET `/api/v1/safety/eligibility/` returns 401, not 404. Then, with the member's normal app session, GET must return `data.eligible: false` before acceptance. Submit the member's own birth date and consent in the app; a successful POST and subsequent GET must return `data.eligible: true` and the current policy version. Do not manufacture acceptance records or use someone else's date of birth.

The app already unwraps the backend's `success/data` response envelope. No mobile bypass or endpoint fallback is needed.

The current source also enforces adult eligibility for protected member APIs and chat and mounts public policy/deletion pages. Follow the broader coordinated rollout in `RELEASE_FIXES.md`; it includes settings and chat-storage migrations. Validate the actual deployed source and environment before restarting services.

## Current deployment status

Local changes are ready. Production was not modified: `ssh -o BatchMode=yes root@187.127.157.140` returned `Permission denied (publickey,password)`. A working deployment identity or a server operator is required to finish the live fix. Do not paste passwords or private keys into chat.


Rechecked after the latest fix request: SSH to the documented host still returns `Permission denied (publickey,password)`. No production files or database records were changed. Configure an authorized SSH identity in the local SSH agent or have the server operator deploy the reviewed source; do not paste credentials in chat.
