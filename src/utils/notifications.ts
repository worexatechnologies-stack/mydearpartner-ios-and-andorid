import { DeviceEventEmitter } from 'react-native';

export const SHOW_IN_APP_NOTIFICATION_EVENT = 'SHOW_IN_APP_NOTIFICATION';

export interface InAppNotificationData {
  title: string;
  message: string;
  icon?: string; // Ionicons name (e.g. 'heart', 'chatbubble-ellipses')
  type?: 'interest' | 'message' | 'system';
  avatarUrl?: string;
  subtitle?: string;
  duration?: number;
  onPress?: () => void;
}

/**
 * Triggers a global in-app notification (floating interactive pill) from anywhere in the app.
 * Dispatches asynchronously to safely run outside React render cycles.
 */
export function showInAppNotification(data: InAppNotificationData) {
  setTimeout(() => {
    DeviceEventEmitter.emit(SHOW_IN_APP_NOTIFICATION_EVENT, data);
    const { triggerHaptic } = require('./haptics');
    triggerHaptic('notificationSuccess');
  }, 0);
}
