# Profile photo upgrade

- Discovery now reads the backend's `primary_photo` metadata, preserving the protected image URL, version query, and stable photo ID.
- Edit Profile fetches `/api/v1/profile-photos/mine/` to replace legacy URL-only gallery data with authoritative records and the server's photo limit.
- Upload uses multipart POST `/api/v1/profile-photos/` and retains the returned ID and URL. Delete uses `/api/v1/profile-photos/{id}/`; failed deletion leaves the photo visible.
- The Main badge follows server primary-photo metadata and the replacement ID returned after deletion.
- Card images offer a retry action that refreshes an expired authenticated session through the existing API client before retrying the image.
- Photo controls are disabled while the gallery loads or a mutation is in progress. Removed the inaccurate drag-to-reorder instruction.
- The user-requested eligibility bypass remains in place.

Validation: TypeScript passed. The full 35-suite run passed 124 tests, followed by 8 passing focused tests including two new image retry regressions. Changed-file lint passed with warnings and no errors. Production gallery and collection GET requests without credentials returned 401, confirming the routes exist; no production photo mutations were performed.

This completes the photo-focused upgrade. Encryption protocol migration, deployment of the previously prepared backend changes, additional search filters, and comprehensive physical-device testing remain separate outstanding work. Real uploads and deletion should be verified with the user's own signed-in account.
