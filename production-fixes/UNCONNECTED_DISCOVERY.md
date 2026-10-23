# Unconnected profiles missing from Search and Discover

The mobile fix is in this checkout. Search and Discover now hide only pending
requests and accepted connections. Declined, withdrawn and removed relationships
can appear again when the profile otherwise meets the current search filters
and eligibility rules. Blocked profiles remain excluded.

Discover previously also excluded anyone with a historical chat, even after the
connection ended. Chat history no longer determines discovery eligibility.
Changes to active relationships refresh the feed, including changes received
from the other member or restored from cache.

The companion backend repair is [unconnected-discovery.patch](unconnected-discovery.patch).
The server's explicit Discover mode previously excluded all sent interests,
including declined and withdrawn rows. It now excludes only pending/accepted
interests in either direction. Deliberately passed profiles remain excluded.
No database migration is needed for this repair.

Apply from the complete production website/backend repository after the combined
[platform repair](PLATFORM_HARDENING.md):

```sh
git apply --check /absolute/path/to/unconnected-discovery.patch
git apply /absolute/path/to/unconnected-discovery.patch
```

It is independent of the saved-search feature patch. Rebuild/restart the backend
through the normal deployment workflow. This patch has not been deployed here.
Install a newly built mobile app to receive the mobile filtering changes.

Validation: TypeScript and lint passed (0 errors); 73 mobile suites / 406
tests passed, including screen-level declined/withdrawn visibility and provider
refresh after the other member removes a connection. The full backend suite
passed 290 tests with one PostgreSQL-only test skipped. Patch application was
checked against the repaired baseline. Android release APK and AAB rebuilt
successfully; APK signature verified. No live account or production server was
changed.

Android artifacts for this correction:

- `android/app/build/outputs/apk/release/app-release.apk`: SHA-256 `32d3e32a89bcd92bbfed00d0b80a7ee7aa807ed73392dab9bd342b278568e451`.
- `android/app/build/outputs/bundle/release/app-release.aab`: SHA-256 `7ff0336c93727683c1e6905d70a953752f4d29150e722031e86c0cbee56ae27f`.
