import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export let pendingDeepLink: {
  name: keyof RootStackParamList;
  params?: any;
} | null = null;

export function consumePendingDeepLink() {
  if (
    pendingDeepLink &&
    navigationRef.isReady() &&
    navigationRef.getRootState()?.routeNames.includes(pendingDeepLink.name)
  ) {
    const { name, params } = pendingDeepLink;
    pendingDeepLink = null;
    (navigationRef as any).navigate(name, params);
  }
}

/**
 * Safely navigate to any screen from outside React components
 * (e.g. In-App Notification tap, FCM push notification tap, Notifee tap).
 */
export function navigate(name: keyof RootStackParamList, params?: any) {
  if (
    navigationRef.isReady() &&
    navigationRef.getRootState()?.routeNames.includes(name)
  ) {
    try {
      (navigationRef as any).navigate(name, params);
    } catch {
      // If the screen isn't in the current stack, queue it
      pendingDeepLink = { name, params };
    }
  } else {
    // Navigator not ready at all, queue it
    pendingDeepLink = { name, params };
  }
}

/**
 * Navigate directly to a specific chat room.
 */
export function navigateToChat(
  chatId: string,
  otherProfileId: string,
  fallbackName?: string,
  fallbackPhoto?: string,
) {
  navigate('Chat', {
    chatId,
    otherProfileId,
    fallbackName,
    fallbackPhoto,
  });
}

/**
 * Navigate to the Activity / Interests received tab.
 */
export function navigateToInterests() {
  navigate('Main', { screen: 'Interests' });
}

/**
 * Navigate to a specific user's full profile detail.
 */
export function navigateToProfile(profileId: string) {
  navigate('ProfileDetail', { profileId });
}
