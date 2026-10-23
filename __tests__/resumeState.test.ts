import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadResumeState, sanitizeResumeState, saveResumeState } from '../src/navigation/resumeState';
import { accountStorageKey } from '../src/utils/storage';

beforeEach(async () => { await AsyncStorage.clear(); });

test('restores the selected tab, back stack and chat IDs for the same account', async () => {
  await saveResumeState('alice', { index: 1, routes: [
    { name: 'Main', state: { index: 1, routes: [{ name: 'Discover' }, { name: 'Chats' }] } },
    { name: 'Chat', params: { chatId: 'room', otherProfileId: 'bob', fallbackPhoto: 'private-url' } },
  ] });
  expect(await loadResumeState('alice')).toEqual({ index: 1, routes: [
    { name: 'Main', state: { index: 0, routes: [{ name: 'Chats' }] } },
    { name: 'Chat', params: { chatId: 'room', otherProfileId: 'bob' } },
  ] });
  expect(await loadResumeState('other-account')).toBeUndefined();
});

test('ignores invalid, obsolete and authentication routes', () => {
  for (const value of [null, {}, { routes: [] }, { index: 20, routes: [{ name: 'Main' }] }]) {
    expect(sanitizeResumeState(value)).toBeUndefined();
  }
  expect(sanitizeResumeState({ index: 3, routes: [
    { name: 'Auth', params: { password: 'secret' } },
    { name: 'RemovedScreen' }, { name: 'Chat', params: { chatId: 'missing-partner' } },
    { name: 'EditProfile' },
  ] })).toEqual({ index: 1, routes: [{ name: 'Main' }, { name: 'EditProfile' }] });
});

test('expired snapshots and malformed JSON fall back to normal startup', async () => {
  const key = accountStorageKey('@mdp/navigation-v1', 'alice');
  await AsyncStorage.setItem(key, JSON.stringify({ version: 1, savedAt: Date.now() - 8 * 86400000,
    state: { index: 0, routes: [{ name: 'Settings' }] } }));
  expect(await loadResumeState('alice')).toBeUndefined();
  await AsyncStorage.setItem(key, '{broken');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(await loadResumeState('alice')).toBeUndefined();
  warn.mockRestore();
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    clear: jest.fn(async () => { values.clear(); }),
  };
});
