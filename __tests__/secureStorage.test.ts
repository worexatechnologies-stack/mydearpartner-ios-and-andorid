import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTokens, loadTokens, clearTokens, saveUserIds, clearUserIds, getUserIds } from '../src/utils/keychain';
jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(),
  getGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'secure' },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));
beforeEach(() => jest.resetAllMocks());
test('failed secure storage never writes tokens to plaintext storage', async () => {
  (Keychain.setGenericPassword as jest.Mock).mockRejectedValue(
    new Error('unavailable'),
  );
  await expect(saveTokens('test-access', 'test-refresh')).rejects.toThrow(
    'unavailable',
  );
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});
test('legacy tokens migrate to keychain and plaintext copy is removed', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);
  (Keychain.setGenericPassword as jest.Mock).mockResolvedValue({
    service: 'secure',
  });
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => key === '@auth_tokens_fallback'
    ? JSON.stringify({ accessToken: 'test-access', refreshToken: 'test-refresh' }) : null);
  await expect(loadTokens()).resolves.toEqual({
    accessToken: 'test-access',
    refreshToken: 'test-refresh',
  });
  expect(Keychain.setGenericPassword).toHaveBeenCalled();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@auth_tokens_fallback');
});

test('a locked/unavailable Keychain remains a recoverable error, not a signed-out session', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockRejectedValue(new Error('locked'));
  await expect(loadTokens()).rejects.toThrow('Unlock your device');
  expect(AsyncStorage.getItem).not.toHaveBeenCalledWith('@auth_tokens_fallback');
});


test('failed native deletion cannot restore a logged-out session on restart', async () => {
  const storage = new Map<string, string>();
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { storage.set(key, value); });
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => storage.get(key) ?? null);
  (Keychain.resetGenericPassword as jest.Mock).mockRejectedValue(new Error('locked'));
  (Keychain.getGenericPassword as jest.Mock).mockResolvedValue({ password: JSON.stringify({ accessToken: 'old', refreshToken: 'old-refresh' }) });
  await clearTokens();
  await expect(loadTokens()).resolves.toBeNull();
  expect(Keychain.getGenericPassword).not.toHaveBeenCalled();
});
test('a pending secure write finishes before logout deletes the session', async () => {
  let finish!: (result: unknown) => void;
  (Keychain.setGenericPassword as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pendingSave = saveTokens('old', 'refresh');
  await Promise.resolve();
  const pendingLogout = clearTokens();
  expect(Keychain.resetGenericPassword).not.toHaveBeenCalled();
  finish({ service: 'secure' });
  await pendingSave;
  await pendingLogout;
  expect(Keychain.resetGenericPassword).toHaveBeenCalledTimes(1);
});


test('pending identity writes finish before logout removes account IDs', async () => {
  let finish!: (result: unknown) => void;
  (Keychain.setGenericPassword as jest.Mock).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const pendingSave = saveUserIds('old-profile', 'old-member');
  await Promise.resolve();
  const pendingClear = clearUserIds();
  finish({ service: 'identity' });
  await pendingSave;
  await pendingClear;
  await expect(getUserIds()).resolves.toBeNull();
});
