import { Platform } from 'react-native';

export const ANDROID_PACKAGE_ID = 'com.mydearpartner';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;

/** Only official HTTPS store links may be opened from remote app configuration. */
export function getStoreUrl(value?: unknown): string | undefined {
  if (typeof value === 'string') {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port) {
        if (Platform.OS === 'ios' && url.hostname === 'apps.apple.com' &&
            /\/id\d+(?:\/|$)/.test(url.pathname)) return url.toString();
        if (Platform.OS === 'android' && url.hostname === 'play.google.com' &&
            url.pathname === '/store/apps/details' &&
            url.searchParams.get('id') === ANDROID_PACKAGE_ID) return url.toString();
      }
    } catch { /* Invalid remote configuration uses the known Android listing. */ }
  }
  // The Apple listing ID must be supplied by app-config; never open a placeholder.
  return Platform.OS === 'android' ? PLAY_STORE_URL : undefined;
}
