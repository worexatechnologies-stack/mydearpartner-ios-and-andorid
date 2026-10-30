# Password followed by SMS OTP — corrected 27 October 2026

The current backend repository already implements password followed by OTP.
The earlier diagnosis and `password-login-otp.patch` used an older checkout at
`170514b`. That patch is superseded and must not be applied to current production.
The mobile repair below targets the current repository contract. The deployed
backend must include those OTP commits; no backend change was deployed here.

## Root cause and repair

After the user supplied the repository, its current `main` was fetched at
`3f1a9d33bb908612f41d5b0e5bb61d8756580559`. It includes:

- `d9cd323`: adds OTP verification to member login.
- `09357df`: returns verified OTP tokens to native clients.

The app expected `requires_otp` and an opaque `challenge_id`, then called
`/auth/login/verify/`. The current backend returns `requires_two_factor` and the
registered `mobile_number`, then expects `/auth/otp/verify/`. Rejecting this
successful password response caused the screenshot's "OTP sign-in unavailable"
alert before the code-entry screen could open.

The mobile auth service now accepts the current contract and normalizes it into
its existing OTP UI. It masks the returned mobile number for display and retains
that server-returned destination for verification, including when login used an
email address. Existing opaque challenges remain supported for the supplementary
service. Password-only token responses are still rejected.

| Step | Current complete-backend contract |
| --- | --- |
| Password | `POST /auth/login/` with `{ identifier, password }` |
| Challenge | HTTP 202, `{ data: { requires_two_factor: true, mobile_number, expires_in: 300 } }` |
| Verify | `POST /auth/otp/verify/` with `{ identifier: mobile_number, code, purpose: "TWO_FACTOR" }` |
| Native session | Existing `X-MDP-Client: native` header requests access/refresh tokens after successful verification |
| Resend | Repeat password login after the UI cooldown; the public OTP request route does not support `TWO_FACTOR` |

The pending password is held in memory for resend and cleared on cancellation,
success, logout, session failure, session restoration or signup. Saved-credential
storage is still updated only after successful OTP verification. A failed code
never falls back to password-only authentication or a password-recovery route.

## Live routing evidence

Unauthenticated OPTIONS requests on 27 October confirmed:

| Public endpoint | Result |
| --- | --- |
| `/api/v1/auth/login/` | 200, POST and OPTIONS allowed |
| `/api/v1/auth/otp/verify/` | 200, POST and OPTIONS allowed |
| `/api/v1/member-auth/otp/verify/` | 200, POST and OPTIONS allowed |
| `/api/v1/auth/login/verify/` | 404; this was the app's incorrect route |
| `/api/v1/auth/login/resend-otp/` | 404; resend instead repeats password login |

No password, account identifier, OTP or token was submitted by these probes.
Routing availability and source review do not establish actual SMS receipt.

## Validation and device use

`npm run check` passed: TypeScript, ESLint (0 errors, 264 warnings), 477 mobile
tests in 82 suites, and security-tool regressions. After adding pending-password
cleanup, the 14 auth-context tests and lint for the changed auth files passed again.

Regression cases cover the current backend's response envelope and Indian mobile
formats, malformed destinations, verification payload/purpose, token persistence
only after verification, rejected/cancelled OTP, resend and cancelled challenges.

The connected emulator runs a debug build connected to this workspace's Metro
server. Its bundle was reloaded after the repair. Installed release builds need
to be rebuilt and updated to receive these JavaScript changes.

Real password/SMS acceptance requires the account owner to enter credentials and
the received OTP in the app. No production sign-in, provider message, repository
push or server deployment was performed as part of this repair. The complete
backend's wider security policy and the earlier release blockers remain separate.
