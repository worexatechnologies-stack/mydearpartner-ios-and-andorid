import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Platform } from 'react-native';
import { CHANNEL_ID_MESSAGES, CHANNEL_ID_INTERESTS, getPushRegistrationStatus, getDeviceToken } from './PushNotificationService';

export interface NotificationDiagnostics {
  permission: 'enabled' | 'disabled' | 'provisional' | 'unknown';
  messages: 'enabled' | 'disabled' | 'missing' | 'system' | 'unknown';
  interests: 'enabled' | 'disabled' | 'missing' | 'system' | 'unknown';
  deviceToken: boolean;
  registration: 'unknown' | 'registered' | 'failed';
}

/** Read settings only. Never exposes tokens or claims end-to-end delivery. */
export async function readNotificationDiagnostics(): Promise<NotificationDiagnostics> {
  const result: NotificationDiagnostics = {
    permission: 'unknown', messages: Platform.OS === 'android' ? 'unknown' : 'system',
    interests: Platform.OS === 'android' ? 'unknown' : 'system',
    deviceToken: Boolean(getDeviceToken()), registration: getPushRegistrationStatus(),
  };
  try {
    const settings = await notifee.getNotificationSettings();
    result.permission = settings.authorizationStatus === AuthorizationStatus.PROVISIONAL ? 'provisional'
      : settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED ? 'enabled' : 'disabled';
  } catch { /* Show unknown when native settings cannot be read. */ }
  if (Platform.OS === 'android') {
    for (const [key, id] of [['messages', CHANNEL_ID_MESSAGES], ['interests', CHANNEL_ID_INTERESTS]] as const) {
      try {
        const channel = await notifee.getChannel(id);
        result[key] = !channel ? 'missing' : channel.blocked || channel.importance === 0 ? 'disabled' : 'enabled';
      } catch { /* Keep unknown. */ }
    }
  }
  return result;
}

/** Give one actionable next step without claiming provider/device delivery. */
export function notificationNextStep(result: NotificationDiagnostics): { title: string; body: string; action: 'settings' | 'messages' | 'reconnect' | 'refresh' | 'none' } {
  if (result.permission === 'disabled') return { title: 'Notifications are turned off', body: 'Allow notifications in device settings to receive chat alerts.', action: 'settings' };
  if (result.messages === 'disabled') return { title: 'Chat alerts are turned off', body: 'Turn on the chat notification channel in device settings.', action: 'messages' };
  if (result.messages === 'missing') return { title: 'Chat alerts need setup', body: 'Reconnect notifications to set up chat alerts on this device.', action: 'reconnect' };
  if (!result.deviceToken || result.registration === 'failed') return { title: 'Reconnect chat notifications', body: 'Reconnect this device while online so it can receive new alerts.', action: 'reconnect' };
  if (result.permission === 'unknown' || result.messages === 'unknown') return { title: 'Settings could not be checked', body: 'Refresh the checks or open your device notification settings.', action: 'refresh' };
  if (result.registration === 'unknown') return { title: 'Registration has not been checked', body: 'Reconnect to confirm this device’s registration.', action: 'reconnect' };
  return { title: 'Device settings are ready', body: 'To check delivery, minimize the app and ask a contact to send a new chat message.', action: 'none' };
}
