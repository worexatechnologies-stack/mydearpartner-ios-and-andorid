# Profile state and website synchronization

Website repository: https://github.com/worexatechnologies-stack/My-dear-partner-project-by-worexa
Base commit: `170514b2d56214b7e0a63982e7519df8e2d14422`.

The React Native app already uses `https://mydearpartner.in/api/v1/auth/me/`.
The website backend lacked a state database field and rejected state updates.
The mobile retry logic could remove rejected fields and report success without
saving them. The app now sends the supported website wire names, preserves
explicit clears, propagates rejection, and reads back state/religion before
reporting success. Religion already exists in the website backend.

`profile-state-sync.patch` adds the state model field and migration, accepts
state in profile updates, persists it through the shared account service,
returns it in own/member profile responses, includes it in change notifications,
and adds State / Region to the website edit form and profile location display.
It also includes backend tests for both authentication route aliases.

## Apply and deploy

From a checkout of the website repository:

```sh
git apply --check /absolute/path/to/profile-state-sync.patch
git apply /absolute/path/to/profile-state-sync.patch
cd backend
RENFLAIR_API_KEY=local-test-only DJANGO_SETTINGS_MODULE=config.settings.test   python -m pytest apps/accounts/tests/test_profile_persistence.py -q
```

Use the website's normal deployment workflow to deploy the backend and frontend.
Run `python manage.py migrate` in the deployed backend environment before serving
requests with the new backend code. Rebuild/restart backend and frontend through
the existing workflow. Build and distribute the updated mobile app as well.
The mobile change intentionally reports errors until the backend supports state.

After deployment, use the same account on app and website: save city, state,
and religion in the app, refresh the website, then edit state on the website
and refresh the app profile. Repeat with an explicit state clear.
Existing open sessions may need a refresh to load the new values.

## Validation

- App: 25 tests passed across profile normalization, profile changes, and auth context.
- App TypeScript check and targeted ESLint passed.
- Website: 7 profile persistence tests passed against isolated SQLite, including
  save/reload/clear for state and religion through both route aliases.
- Website TypeScript check passed.
- Django migration consistency check passed (`makemigrations --check --dry-run`).

No live account was changed. The patch has not been pushed or deployed, and
live cross-device synchronization has not been verified.
