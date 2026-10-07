# React Native Core & JNI
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-dontwarn com.facebook.react.**

# Firebase & Push Notifications
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-dontwarn io.invertase.firebase.**
-keep class io.invertase.firebase.** { *; }

# Notifee
-dontwarn app.notifee.**
-keep class app.notifee.** { *; }

# QuickCrypto & Nitro Modules
-dontwarn com.margelo.nitro.**
-keep class com.margelo.nitro.** { *; }
-dontwarn com.quickcrypto.**
-keep class com.quickcrypto.** { *; }

# Keychain
-dontwarn com.oblador.keychain.**
-keep class com.oblador.keychain.** { *; }

# React Native Screens & Gesture Handler
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }

# Razorpay SDK Keep Rules
-dontwarn com.razorpay.**
-dontwarn okio.**
-dontwarn okhttp3.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/
-keepclasseswithmembers class * {
    public void onPaymentSuccess(java.lang.String);
    public void onPaymentError(int, java.lang.String);
}

