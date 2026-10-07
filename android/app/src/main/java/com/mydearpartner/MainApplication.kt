package com.mydearpartner

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannels()
    loadReactNative(this)
  }

  private fun createNotificationChannels() {
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(android.app.NotificationManager::class.java)
      if (notificationManager != null) {
        val chatChannel = android.app.NotificationChannel(
          "mdp_messages_v2",
          "Chat Messages",
          android.app.NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Incoming chat and direct message notifications"
          enableVibration(true)
          setShowBadge(true)
        }
        val interestChannel = android.app.NotificationChannel(
          "mdp_interests_v2",
          "Interests & Matches",
          android.app.NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = "Incoming interests, matches, and profile activity"
          enableVibration(true)
          setShowBadge(true)
        }
        notificationManager.createNotificationChannel(chatChannel)
        notificationManager.createNotificationChannel(interestChannel)
      }
    }
  }
}
