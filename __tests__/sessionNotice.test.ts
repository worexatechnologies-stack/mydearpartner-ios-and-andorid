import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, AppState } from 'react-native';
import { saveSessionReplacedNotice, showPendingSessionNotice, SESSION_REPLACED_MESSAGE } from '../src/services/SessionNoticeService';
import { loadTokens } from '../src/utils/keychain';

jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map();
  return { __esModule: true, default: {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { data.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { data.delete(key); }),
  } };
});
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.removeItem('@mdp/session_replaced_notice');
  (loadTokens as jest.Mock).mockResolvedValue(null);
});

test('background notice is retained and shown once when active', async () => {
  const previousState = AppState.currentState;
  AppState.currentState = 'background';
  await saveSessionReplacedNotice();
  await showPendingSessionNotice();
  expect(alert).not.toHaveBeenCalled();
  AppState.currentState = 'active';
  await showPendingSessionNotice();
  await showPendingSessionNotice();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith('Signed out', SESSION_REPLACED_MESSAGE, [{ text: 'OK' }]);
  AppState.currentState = previousState;
});

test('a delayed notice does not claim that a newer login was signed out', async () => {
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  await saveSessionReplacedNotice();
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'new-login' });
  await showPendingSessionNotice();
  expect(alert).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@mdp/session_replaced_notice')).toBeNull();
  AppState.currentState = previousState;
});
