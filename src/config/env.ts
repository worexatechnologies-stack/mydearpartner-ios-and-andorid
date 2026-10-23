/** Public build target, validated and embedded by Babel. Never contains secrets. */
type BuildTarget = {
  BUILD_ENVIRONMENT: 'production' | 'staging';
  API_ORIGIN: string;
  API_BASE_URL: string;
  WS_BASE_URL: string;
  MEDIA_BASE_URL: string;
};

const DEFAULT_TARGET: BuildTarget = {
  BUILD_ENVIRONMENT: 'production',
  API_ORIGIN: 'https://mydearpartner.in',
  API_BASE_URL: 'https://mydearpartner.in/api/v1',
  WS_BASE_URL: 'wss://mydearpartner.in/ws/',
  MEDIA_BASE_URL: 'https://mydearpartner.in/media',
};

function parseTarget(): BuildTarget {
  const raw = '__MDP_BUILD_TARGET__';
  if (raw && typeof raw === 'string' && !raw.startsWith('__MDP_')) {
    try {
      return JSON.parse(raw);
    } catch {
      // Fallback to default target
    }
  }
  return DEFAULT_TARGET;
}

const target: BuildTarget = parseTarget();
export const { BUILD_ENVIRONMENT, API_ORIGIN, API_BASE_URL, WS_BASE_URL, MEDIA_BASE_URL } = target;
export const APP_NAME = BUILD_ENVIRONMENT === 'staging'
  ? 'My Dear Partner (Staging)'
  : __DEV__ ? 'My Dear Partner (Dev)' : 'My Dear Partner';

/** Preserve existing production storage; staging must not reuse production sessions. */
export const SESSION_STORAGE_SUFFIX = BUILD_ENVIRONMENT === 'staging'
  ? `.staging.${new URL(API_ORIGIN).hostname}` : '';

export default { ...target, APP_NAME };
