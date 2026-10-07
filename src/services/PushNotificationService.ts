/**
 * MyDearPartner — Push Notification Service
 *
 * Uses Notifee for local notifications and FCM for remote push token registration.
 */

import notifee,{
AndroidImportance,
AuthorizationStatus,
EventType,
} from '@notifee/react-native';
import { Platform } from 'react-native';
import * as notificationService from '../api/notificationService';
import {
navigateToChat,
navigateToInterests,
navigateToProfile,
} from '../navigation/navigationRef';

let _deviceToken: string | null = null;
export const CHANNEL_ID_MESSAGES = 'mdp_messages_v2';
export const CHANNEL_ID_INTERESTS = 'mdp_interests_v2';
let _channelsCreated = false;

export async function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android' || _channelsCreated) return;

  await Promise.all([
    notifee.createChannel({
      id: CHANNEL_ID_MESSAGES,
      name: 'Chat Messages',
      description: 'Incoming chat and direct message notifications',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    }),
    notifee.createChannel({
      id: CHANNEL_ID_INTERESTS,
      name: 'Interests & Matches',
      description: 'Incoming interests, matches, and profile activity',
      importance: AndroidImportance.HIGH,
      vibration: true,
      sound: 'default',
    }),
  ]);

  _channelsCreated = true;
}

/**
 * Handle user tapping a notification (from notification bar / Notifee).
 */
export function handleNotificationPress(data?: any) {
  if (!data) return;

  const conversationId =
    data.conversation_id || data.conversationId || data.chat_id;
  const senderId =
    data.profile_id ||
    data.sender_profile_id ||
    data.sender_id ||
    data.senderId;
  const senderName = data.sender_name || data.senderName;
  const isInterest =
    data.kind?.includes('interest') ||
    data.kind?.includes('like') ||
    Boolean(data.interest_id) ||
    data.type?.includes('interest') ||
    data.kind?.includes('match') ||
    Boolean(data.interestId);

  if (isInterest) {
    if (senderId) {
      navigateToProfile(senderId);
    } else {
      navigateToInterests();
    }
  } else if (conversationId) {
    navigateToChat(conversationId, senderId ?? '', senderName);
  } else if (senderId) {
    navigateToProfile(senderId);
  }
}

/**
 * Register Notifee foreground press listener.
 */
export function setupNotifeeForegroundHandler(): () => void {
  return notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification) {
      handleNotificationPress(detail.notification.data);
    }
  });
}

/**
 * Request notification permissions using Notifee and Firebase.
 * Works for both local and remote (FCM) notifications.
 */
export async function requestPermission(): Promise<boolean> {
  try {
    const settings = await notifee.requestPermission();
    await ensureChannels();

    try {
      const {
        getMessaging,
        requestPermission: fcmRequestPermission,
      } = require('@react-native-firebase/messaging');
      if (
        typeof getMessaging === 'function' &&
        typeof fcmRequestPermission === 'function'
      ) {
        await fcmRequestPermission(getMessaging());
      }
    } catch {
      // Firebase messaging optional check
    }

    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch (err) {
    console.warn('[PushNotification] Error requesting permission:', err);
    return false;
  }
}

/**
 * Get FCM token after permissions are granted.
 */
export async function requestPermissionAndGetToken(): Promise<string | null> {
  const hasPermission = await requestPermission();
  if (!hasPermission) return null;

  try {
    const {
      getMessaging,
      getToken,
      getAPNSToken,
      isDeviceRegisteredForRemoteMessages,
      registerDeviceForRemoteMessages,
    } = require('@react-native-firebase/messaging');
    if (typeof getMessaging !== 'function' || typeof getToken !== 'function') {
      console.warn(
        '[PushNotification] FCM modular API not available yet — rebuild the app',
      );
      return null;
    }
    const messaging = getMessaging();
    if (
      Platform.OS === 'ios' &&
      typeof isDeviceRegisteredForRemoteMessages === 'function' &&
      typeof registerDeviceForRemoteMessages === 'function' &&
      !(await isDeviceRegisteredForRemoteMessages(messaging))
    ) {
      await registerDeviceForRemoteMessages(messaging);
    }
    if (Platform.OS === 'ios' && typeof getAPNSToken === 'function') {
      const apnsToken = await getAPNSToken(messaging);
      if (!apnsToken) {
        console.warn(
          '[PushNotification] APNs token is null before getToken, FCM token might not work properly.',
        );
      }
    }
    // APNs/FCM registration can finish a moment after the permission dialog,
    // especially on a fresh iOS install. Retry briefly instead of silently
    // leaving the account without a device token.
    let token: string | null = null;
    for (let attempt = 0; attempt < 3 && !token; attempt += 1) {
      try {
        token = await getToken(messaging);
      } catch (error) {
        if (attempt === 2) throw error;
        await new Promise<void>(resolve => setTimeout(resolve, 1500));
      }
    }
    if (!token) return null;
    _deviceToken = token;
    
    
    
    return token;
  } catch (err) {
    console.warn('[PushNotification] FCM not ready yet:', err);
    return null;
  }
}

/** Keep the backend's device record current when APNs/FCM rotates a token. */
export function subscribeToTokenRefresh(): (() => void) | undefined {
  try {
    const {
      getMessaging,
      onTokenRefresh,
    } = require('@react-native-firebase/messaging');
    if (
      typeof getMessaging !== 'function' ||
      typeof onTokenRefresh !== 'function'
    )
      return undefined;
    return onTokenRefresh(getMessaging(), async (token: string) => {
      _deviceToken = token;
      await registerWithBackend(token);
    });
  } catch (err) {
    console.warn(
      '[PushNotification] Could not subscribe to token refresh:',
      err,
    );
    return undefined;
  }
}

export async function registerWithBackend(token: string): Promise<boolean> {
  _deviceToken = token;
  try {
    return await notificationService.registerDeviceToken(token);
  } catch (err) {
    console.warn(
      '[PushNotification] Failed to register token with backend:',
      err,
    );
    return false;
  }
}

export async function unregisterOnLogout(): Promise<void> {
  const token = _deviceToken;
  _deviceToken = null;
  try {
    if (token) await notificationService.unregisterDeviceToken(token);
  } finally {
    // Invalidate the FCM token even if backend unregistering was unavailable.
    // A subsequent login obtains and registers a fresh token.
    try {
      const { getMessaging, deleteToken } = require('@react-native-firebase/messaging');
      if (typeof deleteToken === 'function') await deleteToken(getMessaging());
      await notifee.cancelDisplayedNotifications();
    } catch {
      // Offline token deletion must not prevent secure local logout.
    }
  }
}

export function getDeviceToken(): string | null {
  return _deviceToken;
}

export async function displayNotification(
  title: string,
  body: string,
  data?: any,
  id?: string,
  channelId?: string,
) {
  try {
    await ensureChannels();

    // Notifee requires notification data values to be strings. FCM payloads
    // can contain null/undefined fields, which otherwise makes the whole local
    // notification fail on some Android and iOS versions.
    const safeData = Object.fromEntries(
      Object.entries(data ?? {})
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)]),
    );

    const targetChannel =
      channelId ||
      (safeData.kind?.includes('interest') || safeData.interest_id
        ? CHANNEL_ID_INTERESTS
        : CHANNEL_ID_MESSAGES);

    const notificationConfig: any = {
      title,
      body,
      data: safeData,
      android: {
        channelId: targetChannel,
        smallIcon: 'ic_stat_notification',
        pressAction: { id: 'default' }, // Makes the tap trigger EventType.PRESS
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [300, 500],
      },
      ios: {
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: true,
          badge: true,
        },
        // Ensure tapping the iOS notification fires EventType.PRESS in onForeground/onBackground handlers
        sound: 'default',
      },
    };

    if (typeof id === 'string' && id.trim().length > 0) {
      notificationConfig.id = id;
    }

    await notifee.displayNotification(notificationConfig);
    return true;
  } catch (err) {
    console.warn('[Notifee] displayNotification error:', err);
    return false;
  }
}
