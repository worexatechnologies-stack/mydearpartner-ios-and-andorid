# Keep retrace metadata so minified release crashes remain diagnosable.
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# Keep the Razorpay callback entry points that are invoked from native code.
-keepclasseswithmembers class * {
    public void onPaymentSuccess(java.lang.String);
    public void onPaymentError(int, java.lang.String);
}

# Suppress optional platform classes referenced by transitive SDK code.
-dontwarn com.facebook.react.**
-dontwarn com.google.firebase.**
-dontwarn io.invertase.firebase.**
-dontwarn app.notifee.**
-dontwarn com.margelo.nitro.**
-dontwarn com.quickcrypto.**
-dontwarn com.oblador.keychain.**
-dontwarn com.swmansion.gesturehandler.**
-dontwarn com.swmansion.rnscreens.**
-dontwarn com.razorpay.**
-dontwarn okio.**
-dontwarn okhttp3.**
