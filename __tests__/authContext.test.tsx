import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { getMyProfile, updateMyProfile } from '../src/api/profileService';
import { loadTokens } from '../src/utils/keychain';
jest.mock('../src/utils/keychain', () => ({
  loadTokens: jest.fn(),
  clearTokens: jest.fn(),
  saveUserIds: jest.fn(),
  clearUserIds: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/api/apiClient', () => ({
  registerUnauthenticatedHandler: jest.fn(),
}));
jest.mock('../src/api/profileService', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));
jest.mock('../src/api/authService', () => ({
  login: jest.fn(),
  logout: jest.fn().mockResolvedValue(undefined),
  register: jest.fn().mockResolvedValue({ user: { id: 'new-user' } }),
}));
jest.mock('../src/services/MessagingCryptoLifecycle', () => ({
  initializeMessagingCrypto: jest.fn(),
  markMessagingCryptoLoggedOut: jest.fn(),
}));
jest.mock('../src/services/PushNotificationService', () => ({
  unregisterOnLogout: jest.fn().mockResolvedValue(undefined),
  requestPermissionAndGetToken: jest.fn(),
  subscribeToTokenRefresh: jest.fn(),
}));
jest.mock('../src/services/NotificationRealtimeService', () => ({
  startNotificationRealtime: jest.fn(() => jest.fn()),
}));
let auth: ReturnType<typeof useAuth>;
let tree: ReactTestRenderer;
function Capture() {
  auth = useAuth();
  return null;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (loadTokens as jest.Mock).mockResolvedValue(null);
});
afterEach(async () => {
  if (tree) await act(async () => tree.unmount());
  jest.useRealTimers();
});
async function mount() {
  await act(async () => {
    tree = create(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(2500);
  });
}
test('failed profile setup remains incomplete and exposes save failure', async () => {
  await mount();
  await act(async () => {
    await auth.signup('test@example.com', 'password');
  });
  (updateMyProfile as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => {
    await expect(
      auth.completeProfile({
        name: 'Test',
        age: 25,
        city: 'Chennai',
        gender: 'female',
        religion: '',
        profession: '',
        education: '',
        height: '',
        about: '',
        photo: '',
        interests: [],
      }),
    ).rejects.toThrow('offline');
  });
  expect(auth.currentUser?.profileComplete).toBe(false);
});
test('restoring an incomplete profile still routes to setup', async () => {
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'test' });
  (getMyProfile as jest.Mock).mockResolvedValue({
    id: 'profile',
    name: '',
    city: '',
    age: 0,
  });
  await mount();
  expect(auth.currentUser?.profileComplete).toBe(false);
});
test('profile edits omit unsupported age while saving other fields', async () => {
  await mount();
  await act(async () => {
    await auth.signup('test@example.com', 'password');
  });
  (updateMyProfile as jest.Mock).mockResolvedValue({ id: 'profile' });
  await act(async () => {
    await auth.updateProfile({
      age: 30,
      horoscope: 'details',
      prompts: [{ question: 'Q', answer: 'A' }],
    });
  });
  expect(updateMyProfile).toHaveBeenCalledWith(
    expect.objectContaining({
      horoscope: 'details',
      prompts: [{ question: 'Q', answer: 'A' }],
    }),
  );
  expect((updateMyProfile as jest.Mock).mock.calls[0][0]).not.toHaveProperty('age');
});

test('profile edits use backend field names without duplicate aliases', async () => {
  await mount();
  await act(async () => {
    await auth.signup('test@example.com', 'password');
  });
  const saved = { id: 'profile', name: 'Updated Member', city: 'Chennai' };
  (updateMyProfile as jest.Mock).mockResolvedValue(saved);
  await act(async () => {
    await auth.updateProfile({ name: 'Updated Member', city: 'Chennai', about: '' });
  });
  expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({
    first_name: 'Updated', last_name: 'Member',
    work_location: 'Chennai',
    about: '',
  }));
  expect(auth.currentUser?.profile).toEqual(saved);
  expect(updateMyProfile).toHaveBeenCalledWith({
    first_name: 'Updated', last_name: 'Member', work_location: 'Chennai', about: '',
  });
});

test('unsupported diet edits fail explicitly without submitting a partial save', async () => {
  await mount();
  await act(async () => {
    await auth.signup('test@example.com', 'password');
  });
  await expect(auth.updateProfile({ diet: 'Vegetarian', city: 'Chennai' }))
    .rejects.toThrow('Diet cannot currently be changed');
  expect(updateMyProfile).not.toHaveBeenCalled();
});

test('offline restoration exposes retry and retains the stored session', async () => {
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'test' });
  (getMyProfile as jest.Mock).mockRejectedValue(new Error('offline'));
  await mount();
  expect(auth.currentUser).toBeNull();
  expect(auth.sessionError).toContain('restore your session');
  (getMyProfile as jest.Mock).mockResolvedValue({ id: 'profile', userId: 'member', name: 'Member', age: 26, city: 'Chennai', gender: 'female' });
  await act(async () => { await auth.retrySession(); });
  expect(auth.sessionError).toBeNull();
  expect(auth.currentUser?.profileComplete).toBe(true);
});

test('a rejected session during restore exits the loading screen', async () => {
  const { registerUnauthenticatedHandler } = require('../src/api/apiClient');
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'test' });
  (getMyProfile as jest.Mock).mockImplementation(async () => {
    const handler = registerUnauthenticatedHandler.mock.calls.at(-1)[0];
    handler();
    throw { status: 401 };
  });
  await mount();
  expect(auth.isLoading).toBe(false);
  expect(auth.currentUser).toBeNull();
});


test('logout while login loads a profile cannot restore the old user', async () => {
  const service = require('../src/api/authService');
  service.login.mockResolvedValue({ user: { id: 'old-user' } });
  let resolveProfile!: (profile: unknown) => void;
  (getMyProfile as jest.Mock).mockReturnValue(new Promise(resolve => { resolveProfile = resolve; }));
  await mount();
  let pending!: ReturnType<typeof auth.login>;
  await act(async () => { pending = auth.login('old@example.com', 'password'); });
  await act(async () => { await auth.logout(); });
  await act(async () => {
    resolveProfile({ id: 'old-profile', name: 'Old', age: 25, city: 'Chennai', gender: 'female' });
    expect(await pending).toMatchObject({ ok: false });
  });
  expect(auth.currentUser).toBeNull();
  expect(auth.isLoading).toBe(false);
  const { initializeMessagingCrypto } = require('../src/services/MessagingCryptoLifecycle');
  expect(initializeMessagingCrypto).not.toHaveBeenCalled();
});

test('logout while registration is pending cannot restore the new user', async () => {
  const service = require('../src/api/authService');
  let resolveRegistration!: (response: unknown) => void;
  service.register.mockReturnValueOnce(new Promise(resolve => { resolveRegistration = resolve; }));
  await mount();
  let pending!: ReturnType<typeof auth.signup>;
  await act(async () => { pending = auth.signup('new@example.com', 'password'); });
  await act(async () => { await auth.logout(); });
  await act(async () => {
    resolveRegistration({ user: { id: 'new-user' } });
    expect(await pending).toMatchObject({ ok: false });
  });
  expect(auth.currentUser).toBeNull();
});


test('profile refresh and edits recompute completion and membership together', async () => {
  await mount();
  await act(async () => { await auth.signup('test@example.com', 'password'); });
  const profile = { id: 'profile', name: 'Member', age: 26, city: 'Chennai', gender: 'female', isPremium: true, currentPlanSlug: 'gold' };
  (getMyProfile as jest.Mock).mockResolvedValue(profile);
  await act(async () => { await auth.refreshCurrentUser(); });
  expect(auth.currentUser).toMatchObject({ profileComplete: true, isPremium: true, planSlug: 'gold' });
  (updateMyProfile as jest.Mock).mockResolvedValue({ ...profile, city: '', isPremium: false, currentPlanSlug: 'free' });
  await act(async () => { await auth.updateProfile({ city: '' }); });
  expect(auth.currentUser).toMatchObject({ profileComplete: false, isPremium: false, planSlug: 'free' });
});
