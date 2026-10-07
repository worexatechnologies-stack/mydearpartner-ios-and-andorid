/**
 * @format
 */

// MUST be the very first import — installs global.crypto.subtle for WebCrypto E2EE
import './src/utils/shim';
import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';

import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import { handleIncomingPush } from './src/services/IncomingPushService';
import { handleNotificationPress } from './src/services/PushNotificationService';

/**
 * FCM Background / Quit-state handler.
 * Runs when the app is in the background or completely killed.
 * Only fires for data-only FCM messages. System-rendered notification-only
 * messages are handled by the OS itself and don't reach this handler.
 */
setBackgroundMessageHandler(getMessaging(), async remoteMessage => {
  await handleIncomingPush(remoteMessage);
});

import App from './App';
import { name as appName } from './app.json';

/**
 * Notifee background event handler.
 *
 * Fires when the user interacts with a LOCAL Notifee notification from the
 * system tray while the app is in the background or completely killed.
 *
 * Key fix: previously this handler ONLY cancelled the notification, so tapping
 * a chat or interest notification from the system tray did nothing.
 * Now it calls handleNotificationPress() to navigate to the correct screen.
 */
notifee.onBackgroundEvent(async ({ type, detail }) => {
  const { notification, pressAction } = detail;

  if (type === EventType.PRESS || (type === EventType.ACTION_PRESS && pressAction?.id === 'default')) {
    // Navigate to the relevant screen (Chat or Interest)
    if (notification?.data) {
      handleNotificationPress(notification.data);
    }
    // Dismiss the tray notification after handling
    if (notification?.id) {
      await notifee.cancelNotification(notification.id);
    }
  } else if (type === EventType.ACTION_PRESS && notification?.id) {
    await notifee.cancelNotification(notification.id);
  }
});

AppRegistry.registerComponent(appName, () => App);
