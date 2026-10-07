import { ImageURISource } from 'react-native';
import { API_BASE_URL,MEDIA_BASE_URL } from '../config/env';

/** Only first-party image requests may receive the session credential. */
export function authenticatedImageSource(
  source: ImageURISource,
  token?: string | null,
): ImageURISource {
  if (!source.uri || !token) return source;
  try {
    const url = new URL(source.uri);
    const trusted = [API_BASE_URL, MEDIA_BASE_URL].some(
      base => new URL(base).origin === url.origin,
    );
    if (url.protocol !== 'https:' || url.username || url.password || !trusted)
      return source;
    return {
      ...source,
      headers: { ...source.headers, Authorization: `Bearer ${token}` },
    };
  } catch {
    return source;
  }
}
