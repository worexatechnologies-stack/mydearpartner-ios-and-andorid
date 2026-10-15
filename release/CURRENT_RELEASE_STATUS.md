# Release work — 7 October 2026

Status: **not ready for public release**. This file records the current pass;
older reports contain superseded checks and must not be read as certification.

## Completed in this pass

- Added `.github/workflows/validation.yml`: mobile typecheck, lint, tests and
  security regressions; local Django system/migration checks and tests; local
  Express compilation. These checks run on main pushes, pull requests and
  manual dispatch after the workflow is pushed. GitHub execution is unverified.
- Re-ran `npm run check`: 49 suites / 227 tests passed; TypeScript, lint and
  security-tool regressions passed. Local log: `/tmp/mdp-release-fix-check.log`.
- Re-ran local Django safety/payments/memberships/config tests: 26 passed;
  system checks passed and `makemigrations --check --dry-run` found no changes.
- Re-ran local Express compilation: passed.
- Parsed the workflow YAML locally. Native/store acceptance is not covered.

## Dependencies still preventing closure

| Item | Current evidence | Needed next |
| --- | --- | --- |
| Coordinated chat security | Current mobile new-message encryption still derives its key from public member IDs. Full upstream source was cloned read-only to `/tmp/mdp-release-backend-review`, revision `1ead2c422bafdf1987a7f7d81b63d4d56c9037e5`. | Resolve requested mobile-only versus coordinated backend/web scope; implement compatible protocol, historical migration and key lifecycle, then deploy and verify. |
| Settings/privacy/deletion | Local source tests do not establish deployed endpoint behavior or deletion processing. No authenticated production checks were run in this pass. | Coordinated backend access and dedicated test accounts; deploy missing contracts and the reviewed public deletion page. |
| Staging/payment acceptance | Release preflight reports no acceptance configuration, staging URL, account pair or sandbox keys. Supplied Downloads/env contains production settings and was inspected by key names only. | Dedicated staging URL and disposable accounts; configure provider sandbox locally. |
| GitHub | `gh auth status` reports signed out. Earlier app push failed authentication. | Authenticate a repository-authorized account locally and push app/workflow changes. |
| Physical acceptance/push | ADB lists no device; Xcode lists only simulators and an offline iPad. | Connected physical Android and iPhone, configured APNs/FCM; two-account tests. |
| iOS signing | Standard Xcode provisioning-profile directory is empty. | Correct Apple distribution identity/profiles; archive, export and install. |
| Android store checks | Earlier local builds exist; this pass did not rebuild or query Play Console. | Check registered upload key/version code, rebuild final revision and test through the store track. |
| Dependencies/capacity/operations | No fresh audit, infrastructure load test or backup/restore exercise in this pass. | Resolve or review advisories, define concurrency target and verify real staging operations. |

No backend/web modification, deployment, account mutation, purchase, push,
store upload or public publication occurred in this pass. The two local backend
folders are partial services and must not replace the production backend.
