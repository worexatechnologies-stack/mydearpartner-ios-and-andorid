import * as Keychain from 'react-native-keychain';
import {
  saveSavedCredentials,
  getSavedCredentials,
  clearSavedCredentials,
  CREDENTIAL_SERVER,
} from '../src/utils/credentialStorage';

jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(),
  getInternetCredentials: jest.fn(),
  resetInternetCredentials: jest.fn(),
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'secure' },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

test('saveSavedCredentials stores username and password in keychain for the server domain', async () => {
  (Keychain.setInternetCredentials as jest.Mock).mockResolvedValue(true);

  const success = await saveSavedCredentials('user@example.com', 'Secret123!');
  expect(success).toBe(true);
  expect(Keychain.setInternetCredentials).toHaveBeenCalledWith(
    CREDENTIAL_SERVER,
    'user@example.com',
    'Secret123!',
    expect.objectContaining({
      accessible: 'secure',
    }),
  );
});

test('saveSavedCredentials gracefully returns false for empty inputs', async () => {
  const result = await saveSavedCredentials('', '');
  expect(result).toBe(false);
  expect(Keychain.setInternetCredentials).not.toHaveBeenCalled();
});

test('getSavedCredentials returns parsed credentials when stored', async () => {
  (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue({
    username: 'user@example.com',
    password: 'Secret123!',
  });

  const creds = await getSavedCredentials();
  expect(creds).toEqual({
    username: 'user@example.com',
    password: 'Secret123!',
  });
  expect(Keychain.getInternetCredentials).toHaveBeenCalledWith(CREDENTIAL_SERVER);
});

test('getSavedCredentials returns null when no credentials stored', async () => {
  (Keychain.getInternetCredentials as jest.Mock).mockResolvedValue(false);

  const creds = await getSavedCredentials();
  expect(creds).toBeNull();
});

test('clearSavedCredentials resets internet credentials in keychain', async () => {
  (Keychain.resetInternetCredentials as jest.Mock).mockResolvedValue(true);

  const cleared = await clearSavedCredentials();
  expect(cleared).toBe(true);
  expect(Keychain.resetInternetCredentials).toHaveBeenCalledWith({
    server: CREDENTIAL_SERVER,
  });
});
