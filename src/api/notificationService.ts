/**
 * MyDearPartner — Push Notification / Device Service
 *
 * Registers APNs device tokens with the Django backend.
 * Expected URL patterns:
 *   POST   /api/v1/devices/          → register device
 *   DELETE /api/v1/devices/{token}/  → unregister on logout
 */

import { Platform } from 'react-native';
import { del,post } from './apiClient';

export interface RegisterDevicePayload {
  token: string;
  platform: 'ios' | 'android';
}

/**
 * Register the device's APNs/FCM push token with the backend.
 * Call this after login and after receiving the push token from the OS.
 */
/** Returns false when the live backend cannot accept device registrations. */
export async function registerDeviceToken(token: string): Promise<boolean> {
  try {
    await post('/devices/', {
      token,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    });
    return true;
  } catch (err: any) {
    if (err?.status === 404) {
      // This is not harmless: without a device token the backend cannot deliver
      // chat or interest pushes while the app is backgrounded.
      console.warn(
        '[PushNotification] Backend /devices/ endpoint is missing; push delivery is disabled.',
      );
      return false;
    }
    throw err;
  }
}

/**
 * Unregister the device token on logout.
 * Prevents push notifications being delivered after logout.
 */
export async function unregisterDeviceToken(token: string): Promise<void> {
  try {
    await del(`/devices/${encodeURIComponent(token)}/`);
  } catch (err: any) {
    if (err?.status === 404) {
      // Backend hasn't implemented this endpoint yet. Silently ignore.
      return;
    }
    // Non-critical — best effort
  }
}
