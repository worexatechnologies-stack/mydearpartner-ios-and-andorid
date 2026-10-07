# UI and keyboard fixes — October 6, 2026

Chat now uses explicit keyboard avoidance on Android as well as iOS. The composer removes home-indicator padding while the keyboard is open, retains the draft, and stays in the flex layout above the keyboard. Message scrolling allows button taps with the keyboard open and dismisses it on drag. Removed unnecessary bottom spacing in the message list. Decorative rings no longer intercept touches. Landscape side insets protect chat controls. The emoji drawer is scrollable and limited by the available window height.

Signup and safety forms also now use explicit Android keyboard avoidance. Discovery photos use the actual card aspect ratio instead of a startup-only screen width, so rotation, split-screen and tablet layouts resize the photos consistently.

## Verification

- `npm run check`: TypeScript passes; ESLint zero errors/218 warnings; 43 suites and 188 tests pass, no skips. Log: `/tmp/mdp-ui-final-check.log`.
- Four new chat regression cases cover Android 320×568 and 800×360, and iOS 375×667 and 1024×768, at a simulated font scale of 1.5. They verify draft retention, composer presence, keyboard padding transitions and subscription cleanup. These are component tests, not physical device screenshots.
- Installed Android debug app loaded updated JavaScript from Metro. Existing discovery, chat list and chat screens rendered. In an existing conversation, an unsent draft and Send button remained above the real Android keyboard. Screenshots: `/tmp/mdp-chat-keyboard-device.png` (1080×2424) and `/tmp/mdp-chat-keyboard-small.png` (720×1280). The smaller viewport wrapped the draft correctly; the composer remained visible. No message was sent. Test draft cleared and display size restored.
- Native rebuild was deliberately stopped when native dependency compilation competed with the emulator for resources. This change does not modify native code or dependencies. Earlier native build results do not establish a rebuilt release containing these JavaScript changes.

## Coverage limits

Reviewed keyboard containers, chat layout, shared screen safe areas, responsive helpers, floating tab layout and discovery photo sizing. This is not a certification of every screen on every device. Actual iOS keyboard interaction, physical tablets/foldables, every form validation state and VoiceOver/TalkBack remain unverified. New release artifacts must be generated before distribution.

Files: `src/screens/ChatScreen.tsx`, `src/screens/auth/SignupScreen.tsx`, `src/components/SafetyCenter.tsx`, `src/screens/main/DiscoverScreen.tsx`, `__tests__/chatKeyboard.test.tsx`.

Keyboard behavior follows the [React Native KeyboardAvoidingView reference](https://reactnative.dev/docs/keyboardavoidingview.html).
