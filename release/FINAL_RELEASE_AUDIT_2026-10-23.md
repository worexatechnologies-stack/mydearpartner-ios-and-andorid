# Final production release audit — 23 October 2026

**Decision: NOT READY. Do not submit these candidates to either store.**

Local source checks and native builds completed, and verified defects were
repaired. Unresolved P1 issues and missing external acceptance prevent a public
release. No production deployment, store submission, purchase, account mutation,
message or test push was performed. Native build-time Crashlytics uploads were
disabled for this audit.

## Baseline and scope

- React Native 0.87.0 / React 19.2.3, package version **0.3.3**.
- Android: `com.mydearpartner`, versionCode **41**, min SDK **24**, compile SDK
  **37**, target SDK **36**, four ABIs, release shrinking enabled and cleartext
  traffic disabled. Release signing uses the existing ignored keystore settings.
- iOS Release: `com.mydearpartner.app`, version **0.3.3**, build **40**; notification
  extension uses the same version/build and the `.ChatNotificationExtension`
  suffix. APNs Release entitlement selects `production`. The built app's
  `MinimumOSVersion` is **17.0** under Xcode 27.1; the app project uses Xcode's
  recommended deployment target, while Pod compilation includes iOS 15.1
  targets. The artifact's minimum, rather than the Pod setting, controls installs.
- Production API: `https://mydearpartner.in/api/v1`; sockets:
  `wss://mydearpartner.in/ws/`. Both built JS bundles contain the production
  build-target literal and no unreplaced build-target placeholder.
- Android and iOS Firebase files identify the same Firebase project and match
  their production package/bundle identifiers. This is configuration inspection,
  not evidence of FCM/APNs delivery.
- `server/` is a supplementary Django payments/membership/safety/session service,
  not the complete production API. `backend/` is a separate Express matching
  gateway/scaffold. Tests use isolated databases; no live database was modified.
- The complete Django/website repository was cloned read-only from
  `worexatechnologies-stack/My-dear-partner-project-by-worexa` at
  `170514b2d56214b7e0a63982e7519df8e2d14422`. Existing platform, discovery and
  saved-search patches plus the new release-readiness patch were applied only
  to ignored local audit checkouts. The website is part of that separate repo.
- The initial mobile commit was `05d4cdc385cf588067fb5f2ca9dd57b2bd264848`, with
  **102 existing changed/untracked paths**. Existing edits were preserved. Git
  HEAD later became `c459469480da80be6ca1c0a8f6af056c3127b3d3` during this work;
  this audit did not run a commit, reset or push. Exact source/patch hashes are
  recorded in `scratch/release-audit-2026-10-23/source-manifest.json`.

Evidence below is under **`scratch/release-audit-2026-10-23/`**, ignored by Git.
It remains local and is not uploaded by this report.

## Executed verification

| Category | Status | Result / evidence |
| --- | --- | --- |
| Mobile TypeScript | PASS | `npm run check`; `mobile-check-final.log` |
| Mobile ESLint | PASS | 0 errors, **264 warnings**; warnings remain |
| Mobile Jest | PASS | **81 suites, 454 tests**, no skips |
| Build-tool security regressions | PASS | Nested/cyclic brace ASTs, shell injection and malformed image cases; same check log |
| Express gateway build/integration tests | PASS | **13 tests**; `gateway-tests.log`; external AI/upstream services mocked |
| Supplementary Django ordinary system checks | PASS | No issues; `django-check-final.log` |
| Supplementary Django migration consistency | PASS | No changes detected; `django-migrations-final.log` |
| Supplementary Django tests, DRF 3.18.2 | PASS | **50 tests**; `django-tests-final.log`; separate fresh local environment with its declared dependencies |
| Full prepared Django ordinary checks/migration consistency | PASS | `full-backend-check.log`, `full-backend-migrations.log`; migration plan captured separately |
| Full prepared Django pytest, DRF 3.18.2 | PASS | **304 passed, 1 skipped**, 46 warnings; `full-backend-pytest-final.log` |
| PostgreSQL-specific test | BLOCKED | Explicit skip requires PostgreSQL integration settings. No Docker/PostgreSQL tooling or acceptance database was available |
| Full prepared notification suite | PASS | **29 tests**, Firebase delivery mocked; `full-backend-notifications-final.log` |
| Full prepared Django `check --deploy --fail-level WARNING` | FAIL | **296 schema/operation-ID warnings**; `prepared-full-django-deploy-check.log`. Serializer/schema gaps remain; do not represent this command as passed |
| Full prepared Django security-tagged deploy check | PASS | `full-backend-security-deploy-check.log`, synthetic production settings only |
| Supplementary Django `check --deploy --fail-level WARNING` | FAIL | HSTS subdomain/preload warnings W005/W021; `supplementary-django-deploy-check.log`. Existing conservative settings retained |
| Prepared website TypeScript / strict lint | PASS | `website-typecheck-final.log`, `website-lint.log` |
| Prepared website tests / security checks | PASS | **46 tests**; `website-tests.log`, `website-security.log` |
| Prepared website production build | PASS | `website-build-final.log`; local build only, telemetry disabled |
| Patch application | PASS | All four patches apply in order to a fresh clone; `patch-validation.log` |
| Android Release APK/AAB build | PASS | `android-release-final.log`; **BUILD SUCCESSFUL**, upload task excluded |
| Android native lint | PASS | **0 errors, 25 warnings**; `android/app/build/reports/lint-results-release.txt` |
| APK signature / ZIP alignment | PASS | APK v2 verification; `zipalign -c -P 16 4`; `apk-signature.log`, `apk-zipalign.log` |
| Android 64-bit ELF static alignment | PASS | All **52** packaged arm64/x86_64 libraries have LOAD alignment >=16 KB; `android-elf-alignment.json`. This does not establish on-device runtime behavior |
| AAB structure / local signature | PASS | Official **bundletool 1.18.3** validate completed; `bundletool-validate-final.log`; jarsigner reports `jar verified` with warnings below |
| Play upload key / store validation | BLOCKED | No Play Console comparison, upload, version-code availability or device acceptance |
| iOS unsigned Release arm64 simulator build | PASS | **BUILD SUCCEEDED**; `ios-simulator.log`; compiled privacy manifest matches source semantically |
| iOS signed device archive / IPA | BLOCKED | Archive command failed: no provisioning profile for `com.mydearpartner.app`; `ios-archive.log`. No signed distribution archive/export or IPA was produced |
| Real Android/iPhone installation and push | BLOCKED | No dedicated physical devices/staging accounts. No current-build device acceptance is claimed |
| Live OTP/recovery, two-account chat, uploads, deletion and sandbox checkout | BLOCKED | Acceptance preflight reports missing staging/account/provider configuration; `acceptance-preflight.log` |
| Live database, PgBouncer/Redis/Celery, backup/restore and load | BLOCKED | No authorized staging/production operational access; source/unit checks are not operational verification |
| Live store privacy forms / billing enrollment / listing metadata | BLOCKED | Store account access, approved program details, actual Apple listing URL and operator declarations remain unverified |

Initial website type checking/build failed on a browser timer typed as
`NodeJS.Timeout`; this was fixed and both commands rerun successfully. An early
mobile run also discovered the separately cloned website's Vitest files under
`scratch/` and failed 12 suites with runner/import errors. Jest now excludes only
that audit directory; all 81 app suites and the website's own 46 Vitest tests were
run independently and passed. Initial relative-path audit harness invocations
were corrected and rerun. These were not silently accepted as successful checks.

## Repairs made in this audit

| Files | Change | Verification |
| --- | --- | --- |
| `server/requirements.txt` | Pin DRF **3.18.2**, resolving three reported DRF advisories | 50 Django tests; final requirements audit reports zero findings |
| `server/config/tests.py` | Reject decompression/non-text request charsets and retain UTF-8 JSON support | Two new tests, with five invalid-charset subcases |
| `production-fixes/release-readiness.patch` | Full backend: strict environment selection, staging/local test payment mode, production live mode, DRF 3.18.2; website timer type fix | Eight environment and six parser cases; full backend/website checks; clean patch application |
| `ios/MyDearPartner/PrivacyInfo.xcprivacy` | Declare **18** data categories actually used by account/profile/chat/search/purchase/support/diagnostic features, with purposes and identity linkage | Two privacy regression tests, plist validation and compiled-manifest comparison |
| `src/config/legal.json`, `server/safety/legal.json` | Disclose Firebase Analytics, Crashlytics, usage diagnostics and account-linked crash reports; policy version 2026-10-23 | Policy equivalence test and new disclosure regression |
| `ios/MyDearPartner.xcodeproj/project.pbxproj` | `MDP_SKIP_CRASHLYTICS_UPLOAD=1` skips symbol/build-event upload for local audit builds; ordinary build behavior remains available | Script regression uses a local stub, checks skip and normal paths; native log confirms skip |
| `jest.config.js` | Keep nested audit checkouts out of the app's Jest discovery | Final 81 app suites pass; website tests run separately |
| `__tests__/releasePrivacy.test.ts`, `__tests__/releaseBuildUpload.test.ts` | Three new mobile audit regressions | Included in 454-test result |
| `production-fixes/README.md`, `production-fixes/RELEASE_READINESS.md` | Document patch order, exact test scope and remaining gates | Fresh-clone patch validation |
| This report, current release status and rollback plan | Record actual candidate evidence, unresolved risks and operator gates | Reviewable local artifacts; no rollout performed |

The earlier background-recovery implementation is included in the tested mobile
baseline: account-specific navigation, chat drafts and profile drafts restore
after a process restart; notification/deep-link navigation takes priority. Its
tests pass. Neither platform is guaranteed to keep a background process alive.

## Artifacts

| Artifact | Location | SHA-256 |
| --- | --- | --- |
| Signed APK | `android/app/build/outputs/apk/release/app-release.apk` | `6a868865e09320aeafa472646093cd49599bf3e7dd5a36a035b7f5c5eb524548` |
| Signed AAB | `android/app/build/outputs/bundle/release/app-release.aab` | `dce80385311fb2c3780e1068efd8a2118b20638ff8baec41956088a461887572` |

Audit copies are preserved in `scratch/release-audit-2026-10-23/artifacts/`.
The signing certificate SHA-256 is
`ae56f73dd2c892b3fa1a5abe1e7cf004c3cfb4eaddaf037a56df31d258559fbe`.
It has **not** been matched against Play Console's upload certificate.

The AAB verifier warns about a self-signed certificate, absent signing timestamp
and JarFile/JarInputStream manifest-order consistency. Local `jar verified` and
bundletool validation do not establish Play acceptance. The APK has no enabled
debuggable flag; its merged manifest explicitly disables cleartext traffic.

iOS output:
`scratch/release-audit-2026-10-23/ios-simulator/Build/Products/Release-iphonesimulator/MyDearPartner.app`.
This is an **unsigned simulator application**, not an App Store artifact. Build
metadata and bundle hash are in `ios-artifact-validation.json`.

## Security and external checks

- Initial dependency auditing found three DRF issues in 3.18.1:
  [CVE-2026-114136](https://github.com/advisories/GHSA-3547-9m27-7rxg),
  [CVE-2026-114137](https://github.com/advisories/GHSA-xw6w-gcfp-cf8m), and
  [CVE-2026-114138](https://github.com/advisories/GHSA-33wh-fxxf-88vv).
  Both reviewed requirement sets now pin 3.18.2. Existing deployed environments
  have not been upgraded by this audit; they must be rebuilt through an approved
  deployment. Fresh isolated test environments were used.
- Final supplementary Django production requirements audit: **PASS, 0 findings**.
  Full prepared production requirements audit: **FAIL, 1 remaining advisory** in
  Twisted 26.4.0, [CVE-2026-106454](https://github.com/advisories/GHSA-8pqf-f4m5-798g),
  with no fixed version reported. It concerns IMAP; no IMAP service is configured
  in the reviewed Django/Daphne source. Operator review remains required.
- Mobile `npm audit`: **FAIL, 54 high affected dependency entries**; production
  graph: **FAIL, 24 high entries**. Both trace to the single
  [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  The existing local patch and bounded nested/cyclic AST regressions pass. Audit
  databases do not recognize that local mitigation. No forced React Native
  downgrade or hidden audit exclusion was used.
- Gateway and prepared website production npm audits: **PASS, 0 findings**.
- Limited tracked-file scan found no private-key/service-account/GitHub-token/AWS
  access-key candidates in 559 app and 765 full-repository files. It excludes Git
  history, ignored secrets and files over 2 MB; it is not a comprehensive secret
  or personal-data scan. Values were not printed.
- Read-only HTTPS probes: health **200**, anonymous profiles **401**, saved-search
  API **404**. TLS verified and HSTS present. An anonymous 401 proves only the
  authentication gate, not private-object authorization.
- `/privacy` and `/terms` return **200**; content/operator accuracy is unverified.
  `/account-deletion/` and `/policies/privacy/`, `/policies/terms/`,
  `/policies/safety/` redirect and end in **404**. Both platform association files
  return **404**. Custom-scheme deep links are configured; HTTPS universal/app
  links lack complete native/host association setup.

## Unresolved findings and release gates

No P0 incident was confirmed by the available checks. This is not a guarantee
that no critical vulnerability exists.

| Severity | Finding | Required closure |
| --- | --- | --- |
| P1 | Chat confidentiality: new outgoing mobile messages still use keys deterministically derived from public member IDs and a fixed salt (`crypto.ts`, `AppDataContext.tsx`). Encryption round trips do not prove secrecy; this is not a reviewed E2EE protocol | Coordinated mobile/web/server protocol and history migration, private-key lifecycle/recovery, interoperability and security review. Do not replace one client unilaterally or advertise this format as E2EE |
| P1 | Store purchase readiness: iOS paid purchase path is disabled with an explanatory alert. Android Razorpay checkout lacks demonstrated store-program eligibility, required flow/reporting and regional configuration | Implement the applicable Apple/Google billing or approved program integration, confirm eligible countries/enrollment, and test sandbox purchase/restore/cancel/failure/webhook fulfillment |
| P1 | Public account-deletion and policy alias routes are unavailable on the deployed website; saved-search endpoint is missing | Review and deploy the tested backend/website patches only after authorization; verify exact public URLs and authenticated feature contracts after deployment |
| P1 release gate | Signed iOS distribution, dedicated staging, OTP/recovery, two-client messaging, real-device pushes, real sandbox payments, deletion and database operations are unverified | Obtain protected local configuration/devices/signing, execute the manual matrix below and attach evidence. Missing access is not a test pass |
| P2 | Remaining npm/Twisted audit findings despite the documented reachability/mitigation assessment | Obtain a reviewed risk disposition or safe upstream fixes; rerun audits and regressions |
| P2 | Full `check --deploy` schema warnings and supplementary HSTS warnings | Review schema coverage/operation IDs and deployment policy; rerun full checks without hiding the warnings |
| P2 | HTTPS app/universal links lack association files/native setup | Configure verified Android app-signing fingerprints and Apple app/team associations, deploy files, and test links on physical devices |
| P2 | Privacy manifests are corrected locally, but store forms, processing/retention promises, child-safety contact and support operations remain unverified | Operator review of declarations, SDK privacy reports and actual business practice; complete both store disclosures |

For store rules reviewed during this audit, target SDK 36 meets the currently
published mobile submission target. See [Google's target API requirements](https://support.google.com/googleplay/android-developer/answer/11926878).
16 KB static checks follow [Android's alignment guidance](https://developer.android.com/guide/practices/page-sizes);
runtime acceptance remains separate. Digital subscription eligibility and program
exceptions must be assessed against [Google Payments policy](https://support.google.com/googleplay/android-developer/answer/10281818)
and [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/#payments).
The revised manifest uses [Apple's data-type definitions](https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacycollecteddatatypes/nsprivacycollecteddatatype?language=objc).
Source changes do not submit or approve store privacy declarations.

### Manual acceptance still required

Use two disposable staging accounts, one physical Android device and one physical
iPhone. Configure values in ignored `release/.env.acceptance.local`; do not paste
passwords, tokens, private signing material or provider secrets into chat/reports.

1. Register/login with real test OTP/recovery, complete a profile, restart, edit,
   reload and confirm backend/match persistence. Check expired/invalid tokens,
   refresh/logout, account switching and unauthorized access to the other account.
2. Exchange messages in both directions; verify mobile/web interoperability,
   offline/reconnect/retry, duplicates, history, unblock/unconnect and permission
   changes. Evaluate confidentiality against the coordinated protocol repair.
3. Test FCM/APNs display and tap routing in foreground, background and normally
   terminated states, including muted chats and account changes. Record OS
   versions and notification permissions; force-stop is a separate OS behavior.
4. Test sandbox checkout success/cancel/failure/interruption; verify signatures,
   duplicated/reordered webhooks and server-authoritative entitlements. Verify
   restore behavior using the selected store billing integration.
5. Verify private photos/documents, report/block, deletion/recovery and eventual
   cleanup, worker/beat retries, PostgreSQL constraints/locking, PgBouncer/Redis,
   staging load and a real backup/restore rehearsal.
6. Verify release installs, accessibility, memory/background recovery and 16 KB
   Android runtime. Confirm Play upload key, Apple profiles/archive/export,
   metadata/privacy forms, real listing URLs and the rollout/rollback owner.

## Exact principal commands

Commands ran from the app root unless a directory is shown. Logs contain the
actual results. Provider values used in source tests were synthetic and invalid.

```sh
npm run check
npm audit --json
npm audit --omit=dev --json
npm audit --omit=dev --json --prefix backend
node scripts/release-preflight.cjs
(cd backend && npm test)

# Final supplementary Django environment contains server/requirements.txt.
(cd server && DJANGO_DEBUG=true ../scratch/release-audit-2026-10-23/local-django-env/bin/python manage.py check)
(cd server && DJANGO_DEBUG=true ../scratch/release-audit-2026-10-23/local-django-env/bin/python manage.py makemigrations --check --dry-run)
(cd server && DJANGO_DEBUG=true ../scratch/release-audit-2026-10-23/local-django-env/bin/python manage.py test --noinput)
scratch/release-audit-2026-10-23/python-audit-env/bin/python -m pip_audit -r server/requirements.txt -f json -o scratch/release-audit-2026-10-23/local-django-pip-audit-final.json
scratch/release-audit-2026-10-23/python-audit-env/bin/python -m pip_audit -r scratch/release-audit-2026-10-23/full-backend/backend/requirements/base.txt -f json -o scratch/release-audit-2026-10-23/full-backend-pip-audit-final.json

cd scratch/release-audit-2026-10-23/full-backend/backend
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test ../../python-audit-env/bin/python -m pytest -q
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test ../../python-audit-env/bin/python manage.py check
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test ../../python-audit-env/bin/python manage.py makemigrations --check --dry-run
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test ../../python-audit-env/bin/python manage.py showmigrations --plan
RENFLAIR_API_KEY=local-test-only DJANGO_ENV=local DJANGO_SETTINGS_MODULE=config.settings.test ../../python-audit-env/bin/python manage.py test apps.notifications.tests apps.notifications.test_presence_subscriptions --noinput
cd ../frontend
NEXT_TELEMETRY_DISABLED=1 npm ci
NEXT_TELEMETRY_DISABLED=1 npm run typecheck
NEXT_TELEMETRY_DISABLED=1 npm run lint
NEXT_TELEMETRY_DISABLED=1 npm test
NEXT_TELEMETRY_DISABLED=1 npm run security:tools
NEXT_TELEMETRY_DISABLED=1 npm run build
NEXT_TELEMETRY_DISABLED=1 npm audit --omit=dev --json
```

```sh
# From android/: no Crashlytics mapping upload.
env -u MDP_STAGING_ORIGIN MDP_ENVIRONMENT=production ./gradlew :app:assembleRelease :app:bundleRelease :app:lintRelease --offline -x :app:uploadCrashlyticsMappingFileRelease
./gradlew auditValidateBundle --offline --init-script ../scratch/release-audit-2026-10-23/validate-bundle.init.gradle

# From the app root:
MDP_SKIP_CRASHLYTICS_UPLOAD=1 MDP_ENVIRONMENT=production xcodebuild -workspace ios/MyDearPartner.xcworkspace -scheme MyDearPartner -configuration Release -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath scratch/release-audit-2026-10-23/ios-simulator -jobs 2 ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=NO build
MDP_SKIP_CRASHLYTICS_UPLOAD=1 MDP_ENVIRONMENT=production xcodebuild -workspace ios/MyDearPartner.xcworkspace -scheme MyDearPartner -configuration Release -destination 'generic/platform=iOS' -derivedDataPath scratch/release-audit-2026-10-23/ios-archive-build -archivePath scratch/release-audit-2026-10-23/MyDearPartner.xcarchive -jobs 2 archive
/Users/vikasworexatechnologies/Library/Android/sdk/build-tools/37.0.0/apksigner verify --verbose --print-certs android/app/build/outputs/apk/release/app-release.apk
/Users/vikasworexatechnologies/Library/Android/sdk/build-tools/37.0.0/zipalign -c -P 16 4 android/app/build/outputs/apk/release/app-release.apk
jarsigner -verify -verbose -certs android/app/build/outputs/bundle/release/app-release.aab
java -jar scratch/release-audit-2026-10-23/bundletool-all.jar validate --bundle=android/app/build/outputs/bundle/release/app-release.aab
```

Python subprocess helpers also executed `manage.py check --deploy --fail-level
WARNING` for both Django services and `manage.py check --deploy --tag security
--fail-level WARNING` for the full source, using generated local-only secrets and
synthetic production settings. No production credentials were read or printed.
Read-only HTTPS probes used verified TLS; final policy probes used
`curl --silent --show-error --location --max-time 15 --output /dev/null
--write-out '%{http_code} %{url_effective} %{num_redirects}' <public URL>`.
Custom read-only ELF/manifest/source-hash checks are captured in the corresponding
JSON evidence files. The official bundletool download version/hash is recorded
in `bundletool-release.json`; an initially stalled fetch was retried with bounds.

## Final checklist — 1/10 gates complete

- [x] Android release build verified locally.
- [ ] Signed iOS release archive/export verified.
- [ ] No unresolved P0/P1 release findings.
- [ ] Production API and database acceptance verified.
- [ ] Authentication/private-data authorization verified in intended deployment.
- [ ] Chat confidentiality and two-client delivery verified.
- [ ] Firebase notifications verified on real Android/iPhone devices.
- [ ] Premium payments verified in sandbox under the eligible store integration.
- [ ] Store privacy declarations and policies approved and hosted correctly.
- [ ] Signed artifacts for both platforms and operational rollback verified.

The [rollback plan](ROLLBACK_PLAN_2026-10-23.md) is prepared but not rehearsed.
The next approval should cover a concrete staging integration/acceptance effort;
these results do **not** justify a public release approval.
