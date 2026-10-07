# Release execution — 6 October 2026

Local functional fixes and checks are recorded in RELEASE_FIXES.md. This pass attempts fresh native release artifacts and deployment; it does not publish to either store.

## Access checks

- The documented server `root@187.127.157.140` is unreachable from this execution session (`No route to host`). Earlier sessions reached SSH but were denied authentication. This does not establish that the server is down for everyone.
- HTTPS to `mydearpartner.in` also cannot connect from this session. Live login/chat/push/payment/deletion checks cannot be claimed.
- Android online resolution failed because Maven DNS could not resolve. The cached-dependency build using `--offline` succeeded in 4 minutes 40 seconds, generating fresh signed APK and AAB files.
- Signed iOS archive failed: provisioning profiles for `com.mydearpartner.app` and `com.mydearpartner.app.ChatNotificationExtension` are missing. Certificate subjects confirm installed development identities for both configured teams. The Release app and extension originally used different teams; the extension Release team has been aligned with the main app’s existing team 534N528TM6. No bundle identifier was changed. Distribution credentials/profiles remain unverified.
- The arm64 unsigned iOS simulator Release build passed and the app installed/launched successfully on the booted iPhone 17 Pro simulator. This is a startup smoke check; it cannot be submitted to the App Store.

## Operator inputs required

Provide an authorized SSH host/user or alias reachable by the development machine and the Apple Developer team ID that owns this app. Configure SSH identities and Apple signing credentials locally, not in chat. A staging URL and dedicated test accounts/provider sandbox configuration are needed for end-to-end acceptance. No payments or destructive production account actions were executed.

## Build evidence

- Android online attempt: `/tmp/mdp-final-android-release-build.log`
- Android cached-dependency attempt: `/tmp/mdp-final-android-offline-release.log`
- iOS signed archive attempt: `/tmp/mdp-final-ios-archive.log`
- iOS simulator compilation: `/tmp/mdp-final-ios-simulator.log`

### Android completed

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- Package: `com.mydearpartner`, version `0.3.1`, version code `36`, minimum API `24`, target API `36`.
- APK signature verification passed with apksigner. AAB signature verification reports `jar verified`; jarsigner also reports self-signed-chain, timestamp and JarInputStream/manifest-order warnings. These are recorded in `/tmp/mdp-final-aab-signature.log`; store acceptance is not established by this check.
- Signing certificate SHA-256: `ae56f73dd2c892b3fa1a5abe1e7cf004c3cfb4eaddaf037a56df31d258559fbe`. Confirm this matches the registered upload certificate before submission.
- APK SHA-256: `c4bc7c9d033a9b483b0b62bfde5fca67c66fc410f5a6605afe75546b0842631c`
- AAB SHA-256: `20eda2e1ef4c590ca249db5cc0dbdf9b0da4fa27b5b7399847d5f21b17463361`

The existing root-level Production APK/AAB files were not replaced or submitted. No Play Console validation, upload-key comparison, version-code availability check or physical-device acceptance was performed.


Physical-device discovery lists an iPad (A16) as unavailable and the iPhone 17 Pro as a simulator. No physical-device acceptance was possible in this session.

The dual-architecture iOS simulator attempt ran out of disk space during Reanimated universal-binary creation. Only this attempt’s generated x86_64 intermediate object directories were removed. A retry with `ONLY_ACTIVE_ARCH=YES ARCHS=arm64` is recorded in `/tmp/mdp-final-ios-simulator-arm64.log`. Source files, signing material and Android packages were preserved.


### iOS simulator completed

- Build: **BUILD SUCCEEDED**, `/tmp/mdp-final-ios-simulator-arm64.log`.
- App: `/tmp/mdp-final-ios-simulator/Build/Products/Release-iphonesimulator/MyDearPartner.app`.
- Simulator installation and launch passed (`com.mydearpartner.app`, process 31045).
- Startup screenshot: `/tmp/mdp-final-release-startup.png`. Visual inspection confirms the app renders its “Unable to connect” session-recovery screen with a visible retry button; a successful authenticated session is not claimed.
- Generated intermediates were removed after completion to recover disk space; the app and products were preserved.
- Signed App Store archive/export remains blocked by missing provisioning profiles/distribution setup. No IPA or store submission is claimed.

### Final release status

Local code checks, signed Android package generation and iOS Release simulator startup are complete. Production deployment and authenticated live-flow acceptance remain blocked by connectivity/access; signed iOS distribution and physical-device acceptance still require external setup. The app is not certified ready for public release.
