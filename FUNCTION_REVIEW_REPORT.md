# Function review — 2026-09-30

Read-only application review with three agents covering screens/navigation/components, API/services/state/utilities, and both backend directories. Existing application changes were preserved. This report is the only intentional file addition from this review.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Failed: unsupported `StatusBar` props in five screens |
| `npm run lint` | Passed with 0 errors and 197 warnings |
| `npm test -- --runInBand --silent --watchman=false` | 28 suites passed, 1 failed; 85 tests passed, 1 failed |
| Node backend TypeScript, no emit | Passed (agent check) |
| Django test suite | 14 tests passed (agent check) |

Jest initially could not start because Watchman attempted to write outside the sandbox. Disabling Watchman allowed the suite to run. The failed test at `__tests__/profileNormalization.test.ts:29` mocks only `patch`; `updateMyProfile` now also calls `getMyProfile`, requiring `get`. This is a stale test mock, not evidence that `get` is missing from the actual API client.

## Findings

### High priority

1. **Eligibility failures can grant access.** `src/components/EligibilityBoundary.tsx:114` treats an HTTP 404 or a message containing “not found” as successful consent and saves a local approval. Lines 56–62 reuse that approval without a policy version. A missing endpoint therefore unlocks the app without server-confirmed eligibility/consent, and local consent can survive a policy update. Remove mock success and require authoritative confirmation.

2. **Failed payment webhooks cannot recover on retry.** `server/payments/views.py:56` commits the event record before processing. If activation fails, the record remains; the next delivery returns duplicate success at line 59 without retrying activation. A paid customer can remain without membership. The backend agent reproduced this with an isolated in-memory database. Retry unprocessed events and make processing concurrency-safe.

3. **Different payment events can collide.** `server/payments/views.py:52` falls back to payment ID as the unique event ID. Two event types for the same payment, without a payload `event_id`, are treated as duplicates. The agent reproduced an authorized event suppressing a subsequent captured event. Use a delivery/event identity that distinguishes events.

4. **Daily quotas carry over between accounts.** `src/utils/planAllowance.ts:115` and the related storage functions use date-only keys and shared caches. After one account exhausts interests, another account on the same device can inherit the exhausted state and be blocked from sending. Scope persistence and caches to the authenticated account.

5. **Chat encryption has no private key material.** `src/utils/crypto.ts:174`–207 derives conversation keys from member IDs and a fixed embedded salt. A holder of ciphertext and those IDs can reproduce the key. This previously documented issue was reconfirmed; resolving it requires a coordinated protocol and message migration across clients and the notification extension.

### Medium priority

6. **The project type check is broken.** Unsupported `StatusBar` props occur at `src/screens/SplashScreen.tsx:68`, `src/screens/auth/LoginScreen.tsx:53`, `src/screens/auth/SignupScreen.tsx:76`, `src/screens/auth/ForgotPasswordScreen.tsx:174`, and `src/screens/main/DiscoverScreen.tsx:557`. Casting the value to `any` does not make an unsupported prop valid. This also stops `npm run check` before lint/tests.

7. **Removing a profile photo is not persisted.** `src/screens/EditProfileScreen.tsx:120` only changes `localPhotos`. The save payload at line 194 excludes photos and there is no deletion request. A removed photo returns after reloading the profile.

8. **Four visible search filters do nothing.** Income, lifestyle, community, and family preference update controls/badges, but are absent from the filtering predicate and memo dependencies in `src/screens/main/SearchScreen.tsx:688`–788. Selecting them does not narrow results.

9. **Uploads do not recover from expired access tokens.** `src/api/apiClient.ts:315`–375 sends the stored token and rejects 401 without the refresh/retry behavior used by JSON requests. Photo/verification uploads can fail while a valid refresh token exists.

10. **An old refresh failure can erase a new login.** `src/api/apiClient.ts:133` returns immediately on refresh 401/403, and lines 157–160 clear credentials unconditionally. If the response arrives after logout and a new login, it clears the new session. The identity guard for successful refresh responses does not protect this failure path.

11. **Membership allowances ignore finite limits.** `src/utils/planAllowance.ts:440` and 476 force every premium plan to unlimited interests/views, overriding resolved server limits. `|| 3` and `|| 10` also replace legitimate zero limits. The UI can promise actions that the server rejects.

12. **Expired memberships may still be reported active.** `server/payments/views.py:74` checks status without checking `ends_at`. Before the expiry task updates the row, an elapsed membership is returned as active. The agent reproduced this with a past end date.

13. **Malformed plan IDs become server errors.** `server/payments/views.py:27` catches only `DoesNotExist`; a malformed UUID produces a validation exception and HTTP 500. Validate input and return a client error. Reproduced by the backend agent.

14. **Unrelated interest errors exhaust the daily quota locally.** `src/screens/main/DiscoverScreen.tsx:467` classifies every HTTP 400/403, or a message containing “interest”, as a quota error. It then persists exhaustion at line 476. A duplicate-interest, validation, or permission error can block subsequent valid requests for the day. Similar handling appears in other interest screens. Use an explicit quota error code.

15. **Compare can withdraw an accepted match.** `src/screens/member/CompareScreen.tsx:58` cancels any existing interest without checking its status. `interestStatusFor` returns accepted/mutual interests too (`src/context/AppDataContext.tsx:736`), and cancellation removes the associated chat locally at line 931. Handle accepted and received-pending relationships explicitly, as other profile screens do.

### Lower priority

16. **Older notification times show “0d ago”.** `src/screens/member/NotificationsScreen.tsx:54` divides an hours value by milliseconds per day. Divide hours by 24, or calculate days directly from the millisecond difference.

17. **Profile save regression test needs updating.** `__tests__/profileNormalization.test.ts:3` needs the follow-up GET mock and an assertion matching the current save-then-reload contract.

## Verification limits

Passing tests do not establish that every function or user flow works. This review did not run fresh Android/iOS builds, interact with devices, or exercise authenticated production accounts, real checkout, push delivery, camera uploads, or two-account chat end to end. Backend findings apply to the local implementations; their deployment status was not checked. The small Node backend exposes only a health endpoint. Earlier results in `APP_AUDIT_REPORT.md` are historical and do not supersede the check results above.
