/**
 * MyDearPartner — App-wide Constants
 */

/** HTTP request timeout in milliseconds */
export const REQUEST_TIMEOUT_MS = 30_000;

/** Number of times to retry a failed request (network errors only) */
export const MAX_RETRIES = 2;

/** Keychain service name used for all secure storage */
export const KEYCHAIN_SERVICE = 'com.mydearpartner.app';

/** Keychain account keys */
export const KEYCHAIN_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_ID: 'user_id',
} as const;

/** Default pagination page size */
export const DEFAULT_PAGE_SIZE = 20;

/** WebSocket reconnect delay in milliseconds */
export const WS_RECONNECT_DELAY_MS = 3_000;

/** Maximum WebSocket reconnect attempts */
export const WS_MAX_RECONNECT_ATTEMPTS = 5;
