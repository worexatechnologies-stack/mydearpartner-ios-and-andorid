# Privacy settings rollout

The mobile app uses `GET/PATCH /api/v1/member-auth/privacy-settings/`.
The backend changes are in the sibling checkout:
`../backend-notification-fix/backend` (remote: worexatechnologies-stack/My-dear-partner-project-by-worexa).

## Deployment order

1. Deploy the backend changes, including the new untracked files under `apps/accounts/`:
   `privacy.py`, `privacy_views.py`, `migrations/0045_member_privacy_settings.py`, and `tests/test_privacy_settings.py`.
2. In the production backend environment run `python manage.py migrate accounts`.
3. Restart the Django/ASGI processes so HTTP and WebSocket handlers use the new fields and presence policy.
4. Ship the updated mobile app. No production deployment or database migration was performed in this session.

Existing members receive `show_online_status=true` and `contact_visibility=matches`.
Contact visibility adds restrictions to existing membership, block, eligibility, and unlock checks.
It never grants access on its own. `none` is supported by the API; the existing mobile toggle
stays enabled for both `none` and `matches`, preserving the saved value until the user changes it.
Turning the switch off selects `everyone`, still subject to the existing access rules.

The mobile app no longer reads or writes device-local privacy preferences. If the new API is
unavailable, both privacy switches are disabled. Saved preferences reload on screen focus,
foreground, and the authenticated `privacy.updated` WebSocket event. Chat uses server-filtered
presence snapshots/events instead of inferring online status from typing or messages.

## Validation

- Mobile: 27 suites / 79 tests passed; TypeScript passed; changed privacy files lint clean.
- Backend: 8 privacy/presence tests passed in an isolated SQLite test environment with the declared dependencies.
- `makemigrations --check --dry-run`: no missing migrations.
- Four broader `apps/core/tests/test_profile_unlocks.py` failures reproduce unchanged in the original checkout:
  discovery filtering, daily profile view limits, repeated profile views, and blocked messaging error code.
- Live cross-device behavior still requires deployment and device verification.
