import {
  getMyUserIds,
  isMessageNotified,
  recordMessageNotified,
  resetNotificationTracker,
  setMyUserIds,
} from '../src/utils/notificationTracker';
import {
  waitForMessagingCryptoReady,
  markMessagingCryptoLoggedOut,
  initializeMessagingCrypto,
  getMessagingCryptoState,
} from '../src/services/MessagingCryptoLifecycle';
import { loadTokens, getUserIds } from '../src/utils/keychain';
jest.mock('../src/utils/keychain', () => ({
  loadTokens: jest.fn(),
  getUserIds: jest.fn(),
}));
jest.mock('../src/utils/jwt', () => ({
  getMemberUserIdFromToken: () => 'member',
}));
test('logout clears cached account identities and notification deduplication', () => {
  setMyUserIds('profile', 'member');
  recordMessageNotified('message');
  resetNotificationTracker();
  expect(getMyUserIds()).toEqual({ profileId: null, memberId: null });
  expect(isMessageNotified('message')).toBe(false);
});
test('logout during crypto initialization cannot resurrect the previous identity', async () => {
  let resolve!: (value: any) => void;
  (loadTokens as jest.Mock).mockReturnValue(
    new Promise(done => {
      resolve = done;
    }),
  );
  (getUserIds as jest.Mock).mockResolvedValue({ memberId: 'old-member' });
  const pending = waitForMessagingCryptoReady();
  markMessagingCryptoLoggedOut();
  resolve({ accessToken: 'old-token' });
  await expect(pending).resolves.toBeNull();
  expect(getMessagingCryptoState()).toBe('LOGGED_OUT');
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'new-token' });
  await expect(initializeMessagingCrypto()).resolves.toBe('member');
});
