/**
 * MyDearPartner — Mobile Credential Manager & Password Saver
 *
 * Integrates native credential storage with Google Password Manager (Android)
 * and iCloud Keychain (iOS) via react-native-keychain's Internet Credentials.
 */
import * as Keychain from 'react-native-keychain';
import { API_ORIGIN } from '../config/env';

export const CREDENTIAL_SERVER = API_ORIGIN;

export interface SavedUserCredentials {
  username: string;
  password: string;
}

/**
 * Save user credentials to Google Password Manager / Apple iCloud Keychain.
 */
export async function saveSavedCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  if (!username?.trim() || !password) return false;
  try {
    const result = await Keychain.setInternetCredentials(
      CREDENTIAL_SERVER,
      username.trim(),
      password,
      {
        accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      },
    );
    return Boolean(result);
  } catch (error) {
    console.warn('[CredentialStorage] Could not save credentials:', error);
    return false;
  }
}

/**
 * Retrieve saved user credentials for one-tap fill from Keychain / Keystore.
 */
export async function getSavedCredentials(): Promise<SavedUserCredentials | null> {
  try {
    const result = await Keychain.getInternetCredentials(CREDENTIAL_SERVER);
    if (result && result.username && result.password) {
      return {
        username: result.username,
        password: result.password,
      };
    }
    return null;
  } catch (error) {
    console.warn('[CredentialStorage] Could not retrieve credentials:', error);
    return null;
  }
}

/**
 * Clear saved login credentials from native storage.
 */
export async function clearSavedCredentials(): Promise<boolean> {
  try {
    await Keychain.resetInternetCredentials({
      server: CREDENTIAL_SERVER,
    });
    return true;
  } catch (error) {
    console.warn('[CredentialStorage] Could not clear credentials:', error);
    return false;
  }
}
