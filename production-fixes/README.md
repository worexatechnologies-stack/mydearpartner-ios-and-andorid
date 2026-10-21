# Production chat notification fix

Prepared against production website/backend repository commit
`170514b2d56214b7e0a63982e7519df8e2d14422`:
`https://github.com/worexatechnologies-stack/My-dear-partner-project-by-worexa`.

This patch belongs to that repository, not the React Native app's Express backend.
It has not been deployed or pushed. The production SSH host is not trusted in
this environment, and no phone/emulator was connected during this verification.
No credentials or server permissions were changed. Live health responded 200;
device registration responded 401 without authentication. Neither proves push
receipt on a phone.

Changes:

- Preserve device registrations on credential mismatch, generic NOT_FOUND,
  malformed-payload and other provider errors. Remove a device only on explicit
  token-unregistered errors.
- Use an explicit countdown for manual Celery retries: exponential base 5 seconds,
  capped at 60 seconds, full jitter, minimum 1 second, maximum 3 retries.
- Surface missing-credentials retry exhaustion and permanent provider errors as
  task failures instead of reporting a successful empty result. Existing per-device
  deduplication remains in place; it does not guarantee exactly-once delivery.
- Add five regression tests for these behaviors.

Validation: 29 notification tests passed, including the device/push suite and
WebSocket notification consumer suite. Firebase sends were mocked; no message or
test push was sent to a production account. Test database was isolated SQLite.
Existing source registers task sends after transaction commit; this patch does
not change chat creation or mobile code.

Apply from a checkout of the complete production backend repository:

```sh
git apply --check /absolute/path/to/chat-notification-reliability.patch
git apply /absolute/path/to/chat-notification-reliability.patch
cd backend
DJANGO_SETTINGS_MODULE=config.settings.test python manage.py test \
  apps.notifications.tests.DeviceRegistrationAndPushTests \
  apps.notifications.tests.NotificationConsumerTests --noinput
```

Run the test command from `backend/` with its dependencies installed and required
local test environment configured. In this audit, an isolated Python 3.12
virtual environment and a dummy `RENFLAIR_API_KEY` were used; no OTP was sent.
If the code has changed since the base commit, review conflicts rather than
forcing the patch. Review and deploy through the existing production CI/CD
workflow, rebuilding/recreating both backend and worker for Python source changes.

After deployment, verify a real chat for a dedicated test account in foreground,
background and normally closed states, plus notification-tap routing. FCM
acceptance is not evidence of device display. Android force-stop is distinct
from swiping away the app.

The previously reported service-account file mode 0644 also needs correction on
the verified server: determine the actual host/container UID or group, then grant
only that identity read access (0600 owner-only or 0640 with an appropriate group).
Do not blindly chmod 0600 on a root-owned file if the container runs as appuser.
Never commit or paste the service-account contents. No server change was made here.
