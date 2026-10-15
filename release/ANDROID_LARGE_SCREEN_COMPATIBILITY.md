# Android large-screen and window compatibility

## Changes

- Razorpay checkout uses `rotate: true`, the SDK's documented option for allowing
  the payment page to follow orientation. Its default is `false`.
- The application and Razorpay CheckoutActivity explicitly allow resizing.
  MainActivity already has no orientation lock and handles configuration changes.
- Android 15+ uses a splash theme without app-defined deprecated system-bar color
  attributes. Android 14 and earlier retain the existing splash bar colors.
- Material Components is upgraded from the previously resolved 1.13.0 to 1.14.0,
  which guards legacy system-bar color APIs on Android 15+ and adds inset protection
  to dialogs. Legacy API references can still exist in the compiled dependency.

## Remaining SDK warnings

These changes do **not** guarantee removal of Play Console's static API warnings.
The installed React Native 0.87.0 WindowUtil.enableEdgeToEdge implementation still
calls legacy window color setters and uses legacy cutout modes for older devices.
React Native Android is consumed as a compiled Maven artifact; patching the
node_modules Kotlin source alone would not change that artifact.

Razorpay Checkout 1.6.41 is the latest checkout artifact listed in Maven Central
when checked. Its BaseCheckoutActivity contains SDK-owned orientation/window
logic. `rotate: true` changes checkout behavior but does not remove SDK bytecode.
Any remaining warnings from that class require a vendor implementation change.

The existing release mapping identifies `vn1` as MaterialDatePicker and `ym` as
BottomSheetDialog. `l33` is an R8-generated API outline with WindowManager.LayoutParams
methods; its synthetic owner is not sufficient to attribute those calls to WorkManager.
Obfuscated names must be checked against the mapping for the exact uploaded build.

## Validation and device checks

TypeScript and Android debug manifest/resource processing passed. Gradle dependency
inspection confirms Material 1.14.0 is selected with the upgraded dependency.
No Android device was connected; the only configured emulator uses API 37.1.
Android 14–16 tablet/foldable behavior has **not** been verified on a device.

Before release, test on API 34, 35 and 36 with both a phone and a tablet/foldable
(smallest width at least 600dp):

1. Rotate login, signup, discovery, search, chat and membership in both directions;
   check that controls remain reachable with the keyboard open and forms retain data.
2. Resize in split screen and fold/unfold; check scrolling, dialogs and safe-area
   padding around status bars, gesture navigation, three-button navigation and cutouts.
3. Use Razorpay test mode to rotate and resize checkout before and during payment;
   verify successful, cancelled and failed flows and server-side verification.
4. Upload the newly built release bundle and inspect its warnings with its own R8
   mapping. Existing Play warnings refer to the previously uploaded artifact.

References:

- [Android 16 adaptive layout requirements](https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability)
- [Android 15 window API changes](https://developer.android.com/about/versions/15/behavior-changes-15)
- [Razorpay React Native checkout options](https://d6xcmfyh68wv8.cloudfront.net/docs/payments/payment-gateway/react-native-integration/standard/build-integration-android/)
- [Material 1.14 system-bar compatibility](https://github.com/material-components/material-components-android/blob/1.14.0/lib/java/com/google/android/material/internal/EdgeToEdgeUtils.java)
