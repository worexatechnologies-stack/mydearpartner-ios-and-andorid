import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadTokens } from '../utils/keychain';
import { Alert, AppState } from 'react-native';
import { SESSION_STORAGE_SUFFIX } from '../config/env';

const NOTICE_KEY = `@mdp/session_replaced_notice${SESSION_STORAGE_SUFFIX}`;
export const SESSION_REPLACED_MESSAGE = 'Your account was signed in on another device. You have been logged out.';
let showing = false;

export async function saveSessionReplacedNotice(): Promise<void> {
  await AsyncStorage.setItem(NOTICE_KEY, 'true');
}

export async function showPendingSessionNotice(): Promise<void> {
  if (showing || AppState.currentState !== 'active') return;
  showing = true;
  try {
    if (await AsyncStorage.getItem(NOTICE_KEY) !== 'true') return;
    await AsyncStorage.removeItem(NOTICE_KEY);
    if (await loadTokens()) return;
    Alert.alert('Signed out', SESSION_REPLACED_MESSAGE, [{ text: 'OK' }]);
  } finally {
    showing = false;
  }
}
