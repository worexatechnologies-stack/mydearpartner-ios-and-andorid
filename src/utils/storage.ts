import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Small typed wrapper around AsyncStorage used to persist app state
 * locally using account-scoped keys. Authentication stays in Keychain.
 */
export const StorageKeys = {
  USERS: '@mdp/users',
  CURRENT_USER_ID: '@mdp/currentUserId',
  INTERESTS: '@mdp/interests',
  CHATS: '@mdp/chats',
  MESSAGES: '@mdp/messages',
  SHORTLIST: '@mdp/shortlist',
  CLEARED_NOTIFS: '@mdp/clearedNotifs',
  MUTED_USERS: '@mdp/mutedUsers',
  SETTINGS_V30: '@mdp/settings-v30',
} as const;

/** Keep member-specific preferences separate when multiple accounts share a device. */
export function accountStorageKey(key: string, accountId: string): string {
  return `${key}:${encodeURIComponent(accountId)}`;
}

export async function getItem<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (e) {
    console.warn(`Failed to read ${key} from storage`, e);
    return null;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed to write ${key} to storage`, e);
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (e) {
    console.warn(`Failed to remove ${key} from storage`, e);
  }
}
