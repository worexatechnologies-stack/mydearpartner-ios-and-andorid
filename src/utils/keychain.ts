/**
 * MyDearPartner — Secure Keychain Storage
 *
 * Wraps react-native-keychain for secure JWT token storage.
 * Tokens are stored in the iOS Keychain (hardware-backed on modern devices).
 *
 * Uses AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY so that background handlers
 * (FCM background message handler, Notification Service Extension) can read
 * tokens even when the device screen is locked. This matches the standard
 * behaviour of E2EE messaging apps like WhatsApp/Signal.
 *
 * IMPORTANT: Never store tokens in AsyncStorage — it is unencrypted plaintext.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { KEYCHAIN_SERVICE } from '../config/constants';

export interface StoredCredentials {
  accessToken: string;
  refreshToken: string | null;
}

const FALLBACK_KEY = '@auth_tokens_fallback';
const LOGGED_OUT_KEY = '@mdp/session_logged_out';
let tokenWriteQueue: Promise<void> = Promise.resolve();

function writeTokensSerially(write: () => Promise<void>): Promise<void> {
  const result = tokenWriteQueue.then(write);
  tokenWriteQueue = result.catch(() => {});
  return result;
}
const USER_IDS_KEY = '@mdp/user_ids';
const MESSAGING_IDENTITY_SERVICE = `${KEYCHAIN_SERVICE}.messaging-identity`;

export let currentAccessToken: string | null = null;

/** Store tokens securely; native storage failures must not downgrade to plaintext. */
export async function saveTokens(
  accessToken: string,
  refreshToken: string | null,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  return writeTokensSerially(async () => {
    if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');
    if (!accessToken || typeof accessToken !== 'string')
      throw new Error('Invalid access token.');
    const result = await Keychain.setGenericPassword(
      'auth_tokens',
      JSON.stringify({ accessToken, refreshToken }),
      {
        service: KEYCHAIN_SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
    if (!result)
      throw new Error('Could not securely save your session. Please try again.');
    currentAccessToken = accessToken;
    await AsyncStorage.removeItem(FALLBACK_KEY);
    await AsyncStorage.removeItem(LOGGED_OUT_KEY);
    await AsyncStorage.removeItem('@mdp/session_replaced_notice');
  });
}

/**
 * Load authentication tokens from the iOS Keychain.
 * Returns null if no tokens are stored.
 */
export async function loadTokens(): Promise<StoredCredentials | null> {
  await tokenWriteQueue;
  // Native deletion may fail while a device is locked. Persisted logout intent
  // still prevents the next process from restoring those old credentials.
  if (await AsyncStorage.getItem(LOGGED_OUT_KEY) === 'true') {
    currentAccessToken = null;
    return null;
  }
  try {
    const result = await Keychain.getGenericPassword({
      service: KEYCHAIN_SERVICE,
    });

    if (result && result.password) {
      const parsed = JSON.parse(result.password);
      if (typeof parsed?.accessToken === 'string' && parsed.accessToken &&
          (parsed.refreshToken == null || typeof parsed.refreshToken === 'string')) {
        currentAccessToken = parsed.accessToken;
        return {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken ?? null,
        };
      }
    }
  } catch {
    throw new Error('Secure session storage is unavailable. Unlock your device and try again.');
  }

  // Migrate legacy plaintext sessions into secure storage before using them.
  try {
    const fallbackStr = await AsyncStorage.getItem(FALLBACK_KEY);
    if (fallbackStr) {
      const parsed = JSON.parse(fallbackStr);
      if (typeof parsed?.accessToken === 'string' && parsed.accessToken &&
          (parsed.refreshToken == null || typeof parsed.refreshToken === 'string')) {
        await saveTokens(parsed.accessToken, parsed.refreshToken ?? null);
        return {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken ?? null,
        };
      }
    }
  } catch {
    // Ignore
  }
  currentAccessToken = null;
  return null;
}

/**
 * Remove all authentication tokens from the Keychain.
 */
async function deleteStoredTokens(): Promise<void> {
  currentAccessToken = null;
    let intentSaved = false;
    let nativeCleared = false;
    try {
      await AsyncStorage.setItem(LOGGED_OUT_KEY, 'true');
      intentSaved = true;
    } catch {
      // Still try native deletion when local storage is unavailable.
    }
    try {
      nativeCleared = await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
    } catch {
      // Persisted logout intent prevents restoration if native deletion fails.
    }
    try {
      await AsyncStorage.removeItem(FALLBACK_KEY);
    } catch {
      if (!intentSaved) throw new Error('Could not clear your session. Please try again.');
    }
    if (!intentSaved && !nativeCleared) {
      throw new Error('Could not clear your session. Please try again.');
    }
}

export async function clearTokens(): Promise<void> {
  currentAccessToken = null;
  return writeTokensSerially(deleteStoredTokens);
}

/** Compare and clear inside the same queue as login writes. */
export async function clearTokensForSession(expected: StoredCredentials): Promise<boolean> {
  let cleared = false;
  await writeTokensSerially(async () => {
    const result = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
    if (!result) return;
    const actual = JSON.parse(result.password);
    if (actual.accessToken !== expected.accessToken || actual.refreshToken !== expected.refreshToken) return;
    await deleteStoredTokens();
    await deleteStoredUserIds();
    cleared = true;
  });
  return cleared;
}

/**
 * Check if tokens exist in the Keychain (for session restoration).
 */
export async function hasStoredTokens(): Promise<boolean> {
  const creds = await loadTokens();
  return creds !== null;
}

// ─── User ID Persistence (for headless background tasks) ─────────────────────
// The FCM background handler runs without the React tree. It needs the member ID
// (from the JWT) and the profile ID to construct the correct E2EE decryption seed.
// We persist these to AsyncStorage so they survive app kills and are available
// instantly in the headless JS context.

export interface StoredUserIds {
  profileId: string;
  memberId: string;
}

/**
 * Persist the current user's profile ID and member ID for background access.
 * Called after login/session restoration once the member ID is resolved.
 */
import {
getMyUserIds,
resetNotificationTracker,
setMyUserIds,
} from './notificationTracker';

export async function saveUserIds(
  profileId: string,
  memberId: string,
): Promise<void> {
  return writeTokensSerially(async () => {
    setMyUserIds(profileId, memberId);
    const payload = JSON.stringify({ profileId, memberId });
    try {
      await Keychain.setGenericPassword('messaging_identity', payload, {
        service: MESSAGING_IDENTITY_SERVICE,
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    } catch {
      // Best effort Keychain write
    }
    try {
      await AsyncStorage.setItem(USER_IDS_KEY, payload);
    } catch {
      console.warn(
        '[Keychain] Could not persist messaging identity to AsyncStorage',
      );
    }
  });
}

/**
 * Load the persisted profile ID and member ID.
 * Used by the headless FCM background handler.
 */
export async function getUserIds(): Promise<StoredUserIds | null> {
  await tokenWriteQueue;
  const sync = getMyUserIds();
  if (sync.profileId && sync.memberId) {
    return { profileId: sync.profileId, memberId: sync.memberId };
  }

  // Fast path: AsyncStorage
  try {
    const raw = await AsyncStorage.getItem(USER_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.profileId && parsed?.memberId) {
        setMyUserIds(parsed.profileId, parsed.memberId);
        return parsed;
      }
    }
  } catch {
    // Ignore
  }

  // Keychain path
  try {
    const result = await Keychain.getGenericPassword({
      service: MESSAGING_IDENTITY_SERVICE,
    });
    if (result && result.password) {
      const parsed = JSON.parse(result.password);
      if (parsed?.profileId && parsed?.memberId) {
        setMyUserIds(parsed.profileId, parsed.memberId);
        return parsed;
      }
    }
  } catch {
    // Fall through
  }

  return null;
}

/**
 * Clear persisted user IDs on logout.
 */
async function deleteStoredUserIds(): Promise<void> {
    resetNotificationTracker();
    try {
      await Keychain.resetGenericPassword({
        service: MESSAGING_IDENTITY_SERVICE,
      });
    } catch {
      // Ignore
    }
    try {
      await AsyncStorage.removeItem(USER_IDS_KEY);
    } catch {
      // Ignore
    }
}

export async function clearUserIds(): Promise<void> {
  return writeTokensSerially(deleteStoredUserIds);
}
