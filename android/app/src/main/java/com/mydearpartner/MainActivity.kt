package com.mydearpartner

import android.os.Bundle
import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "MyDearPartner"

  /**
   * Switch from SplashTheme (shown on cold start) to AppTheme before React Native renders.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    // react-native-screens requires null to prevent Fragment restoration crashes on activity recreation
    super.onCreate(null)

    // Unlock dynamic high refresh rate (30Hz, 60Hz, 90Hz, 120Hz, 144Hz)
    configureDynamicRefreshRate()

    // Android 13+ requires an explicit runtime grant. Request it at startup so
    // notification delivery does not depend on the user reaching the login flow.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
        checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      ActivityCompat.requestPermissions(
        this,
        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
        7001
      )
    }
  }

  /**
   * Configures the window to support maximum refresh rates (30Hz, 60Hz, 90Hz, 120Hz, 144Hz)
   * dynamically based on device display hardware capabilities.
   */
  private fun configureDynamicRefreshRate() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val currentDisplay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          display
        } else {
          @Suppress("DEPRECATION")
          windowManager.defaultDisplay
        }

        val modes = currentDisplay?.supportedModes
        if (modes != null && modes.isNotEmpty()) {
          var bestMode = modes[0]
          for (mode in modes) {
            if (mode.refreshRate > bestMode.refreshRate) {
              bestMode = mode
            }
          }
          if (bestMode.refreshRate > 60.0f) {
            val params = window.attributes
            params.preferredDisplayModeId = bestMode.modeId
            params.preferredRefreshRate = bestMode.refreshRate
            window.attributes = params
          }
        }
      }
    } catch (_: Exception) {
      // Graceful fallback for devices or emulators without custom display modes
    }
  }

  /**
   * Returns the instance of the [ReactActivityDelegate].
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName)
}
