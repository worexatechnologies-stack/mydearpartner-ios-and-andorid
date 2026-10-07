> Latest review: [Public release audit — 7 October 2026](PUBLIC_RELEASE_AUDIT_2026-10-07.md). The evidence below is historical.

# Public release readiness — 6 October 2026

Decision: **Do not release publicly yet.** Complete local mobile/web/backend checks now pass after remediation. Live backend deployment, staging acceptance and fresh signed physical-device tests remain outstanding; SSH access to the documented server is rejected.

## Remediation update

Local mobile, complete Django and web fixes have now been implemented. See [RELEASE_FIXES.md](RELEASE_FIXES.md) for current validation, encryption rollout instructions and outstanding release gates. The initial observations below are historical; they do not describe the updated local code. Live production has not been updated.

## Current evidence

- `npm run check`: TypeScript passes, lint has zero errors and 218 warnings, 46 Jest suites / 203 tests pass.
- Local Django: `DJANGO_DEBUG=true .venv/bin/python manage.py test safety payments memberships --noinput` passes 22 tests. This validates local modules, not the deployed full backend.
- Explicit `npm audit --audit=true --json`: 71 findings (63 high, 8 moderate). These need assessment by runtime/build exposure and remediation; counts alone do not prove exploitable production paths. The initial default audit produced no output, so it was rerun explicitly enabled.
- Read-only, unauthenticated production GET checks: `/api/v1/settings/`, `/api/v1/verification/`, `/api/v1/safety/eligibility/` return 404; `/api/v1/auth/me/` returns 401. A 401 establishes a protected reachable route, not successful authentication. Public privacy/deletion URLs returned 308; final destinations/content were not verified in this pass.
- Save Profile label visually verified centered and fully visible in the booted iOS simulator after the shared button correction.

## Blockers

1. `src/utils/crypto.ts` derives conversation keys from sorted user IDs and a fixed salt. These inputs cannot establish a private shared secret. Coordinate a mobile/web/backend key exchange and history migration before relying on chat confidentiality.
2. Restore and validate missing production endpoint contracts. The local Express backend is a health scaffold; local Django routes cover payments and safety rather than the complete auth/profile/chat service. Neither should replace the production backend.
3. Local Django requirements still pin 4.2.16. Django 4.2 security support ended 7 April 2026: https://www.djangoproject.com/download/. Upgrade on a compatible supported Python/dependency stack and validate the actual deployment.
4. `EligibilityBoundary` is not mounted in the active App/navigation code. Existing remediation documentation describing an active eligibility gate is not evidence that the current app enforces it. Verify age enforcement across registration, member APIs and WebSocket access in the complete backend.
5. Close dependency audit findings, documenting exposure and accepted exceptions where appropriate.
6. Signed release builds and real-device acceptance remain required: signup/login/session expiry, profile persistence/photo operations, two-account interests/chat, APNs/FCM background delivery, sandbox payments/webhooks, reports/blocking and actual account/data deletion. Passing unit tests does not close these gaps.

No production mutations, deployments, payments, account changes or store publication were performed. This pass does not certify store compliance, live infrastructure, backups, monitoring or load capacity. Production backend source/access and dedicated staging accounts are needed to finish integration verification safely.

Logs for this pass: `/tmp/mdp-public-release-check.log`, `/tmp/mdp-public-backend-check.log`, `/tmp/mdp-public-release-audit.json`. Temporary logs are not durable CI evidence.
