import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { get, post } from '../src/api/apiClient';
import { createPaymentOrder } from '../src/api/paymentService';
import { loadTokens, saveTokens } from '../src/utils/keychain';
import { getSavedCredentials } from '../src/utils/credentialStorage';
import { accountStorageKey, getItem, setItem, StorageKeys } from '../src/utils/storage';
import analyticsService from '../src/services/analyticsService';
import { logEvent } from '@react-native-firebase/analytics';

jest.mock('../src/config/env', () => ({
  BUILD_ENVIRONMENT: 'staging', API_ORIGIN: 'https://staging.mydearpartner.in',
  SESSION_STORAGE_SUFFIX: '.staging.staging.mydearpartner.in',
}));
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(),
}));
jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(), setGenericPassword: jest.fn(), getInternetCredentials: jest.fn(),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'secure' },
}));

beforeEach(() => { jest.clearAllMocks(); });

test('staging never restores production native sessions or legacy plaintext tokens', async () => {
  (Keychain.getGenericPassword as jest.Mock).mockImplementation(async ({ service }) =>
    service === 'com.mydearpartner.app' ? { password: JSON.stringify({ accessToken: 'production-secret' }) } : false);
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => key === '@auth_tokens_fallback'
    ? JSON.stringify({ accessToken: 'production-secret' }) : null);
  await expect(loadTokens()).resolves.toBeNull();
  expect(Keychain.getGenericPassword).toHaveBeenCalledWith({ service: 'com.mydearpartner.app.staging.staging.mydearpartner.in' });
  expect(AsyncStorage.getItem).not.toHaveBeenCalledWith('@auth_tokens_fallback');
  expect(Keychain.setGenericPassword).not.toHaveBeenCalled();
});

test('staging saves tokens and retrieves passwords only in staging storage', async () => {
  (Keychain.setGenericPassword as jest.Mock).mockResolvedValue(true);
  await saveTokens('stage-access', 'stage-refresh');
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('auth_tokens', expect.any(String),
    expect.objectContaining({ service: 'com.mydearpartner.app.staging.staging.mydearpartner.in' }));
  await getSavedCredentials();
  expect(Keychain.getInternetCredentials).toHaveBeenCalledWith('https://staging.mydearpartner.in');
});

test('background and foreground account caches use the same staging key exactly once', async () => {
  const key = accountStorageKey(StorageKeys.MESSAGES, 'same-member');
  expect(key).toBe('@mdp/messages:same-member.staging.staging.mydearpartner.in');
  await setItem(key, { chat: [] });
  await getItem(key);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, JSON.stringify({ chat: [] }));
  expect(AsyncStorage.getItem).toHaveBeenCalledWith(key);
});

test.each([{}, { key_id: 'rzp_live_forbidden' }])('staging never opens checkout using a live fallback or server key: %p', async extra => {
  (post as jest.Mock).mockResolvedValue({ order_id: 'order_test', amount: 100, ...extra });
  await expect(createPaymentOrder('plan')).rejects.toThrow();
});

test('staging accepts the server sandbox key', async () => {
  (post as jest.Mock).mockResolvedValue({ order_id: 'order_test', amount: 100, key_id: 'rzp_test_sandbox' });
  await expect(createPaymentOrder('plan')).resolves.toMatchObject({ key_id: 'rzp_test_sandbox' });
  expect(get).not.toHaveBeenCalled();
});

test('staging does not send analytics events to the production Firebase project', async () => {
  await analyticsService.logEvent('conversation_started', {});
  expect(logEvent).not.toHaveBeenCalled();
});
