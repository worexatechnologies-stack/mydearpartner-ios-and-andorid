# UI refresh and verification — September 25, 2026

## Changes

- Shared ivory, plum, and rose design tokens refresh screens using the central theme. Reduced card radii, quieter shadows, readable buttons, bordered inputs, and compact empty states establish a consistent visual language.
- Rebuilt the welcome screen with an image hero, responsive scrolling, and distinct signup and sign-in actions.
- Replaced the floating tab bar with labeled navigation that reserves layout space and hides while typing.
- Refreshed Discover's heading, conversation cards, profile membership banner, and shared profile controls.
- Discover filters now apply marital status, diet, verification, and online preferences. Added a reset action for empty filtered results and Android back handling for the sheet.
- Fixed disabled secondary-button text contrast and loading-button accessibility labels. Added input-error announcements and image placeholders.
- Image authentication now only adds session credentials for configured first-party HTTPS origins; source options and existing headers are preserved.
- Shared profile cards now render their supplied secondary action.
- Background refresh callbacks read the latest committed state. Message sorting no longer mutates the stored message array. Profile and splash animations stop on unmount.
- Settings writes serialize and recover their displayed values after failures. The former deactivation action only logged out; it now accurately explains the support-assisted deactivation process.
- Removed unused imports and dead handlers, corrected hook dependencies, and excluded generated native dependencies from ESLint. Formatted app source and tests.
- Added `npm run check` to run type checking, lint, and tests together.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed: 0 errors, 177 warnings |
| `npm test -- --runInBand --silent` | Passed: 25 tests across 8 suites |
| Android production Metro bundle | Passed, including asset copying |
| iOS production Metro bundle | Passed, including asset copying |
| `android/gradlew assembleDebug` | Passed: 640 actionable tasks |
| Android emulator navigation | Matches, Search, Activity, Chats, and Profile opened without error overlays; Profile also visually inspected |

New regression tests cover combined discovery filtering, missing profile fields, credential isolation for image requests, shared button accessibility/contrast, and stable callbacks using updated state. Existing interest, payment, app-render, and responsive Discover tests continue to pass.

The debug APK is at `android/app/build/outputs/apk/debug/app-debug.apk`. Production bundling checks wrote temporary outputs under `/tmp`, not over the existing production APK/AAB files.

## Remaining verification

- Native iOS build and device behavior were not tested; the iOS JavaScript bundle passed.
- Live payment, signup, password reset, message delivery, push delivery, and account-changing workflows were not exercised end to end. Existing service tests use mocks.
- Privacy-setting enforcement needs backend verification; saving a preference alone does not prove server-side enforcement.
- Lint warnings remain, mainly inline styles and existing stylistic issues. Metro also reports a dependency importing a private React Native feature-flag path, with a successful fallback.
- This is a shared UI refresh and targeted bug-fix pass, not a guarantee that every screen or backend flow is free of defects. Framework and dependency versions were retained.
