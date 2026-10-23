import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { usePersistentDraft } from '../src/hooks/usePersistentDraft';
import { readResumeValue } from '../src/utils/resumeStorage';
import { accountStorageKey } from '../src/utils/storage';

let result: ReturnType<typeof usePersistentDraft<Record<string, string>>>;
let tree: ReactTestRenderer;
function Capture({ storageKey }: { storageKey: string }) {
  result = usePersistentDraft<Record<string, string>>(storageKey, { text: '', city: '' });
  return null;
}
const key = accountStorageKey('@mdp/test-draft', 'alice');
beforeEach(async () => { await AsyncStorage.clear(); });
afterEach(async () => { await act(async () => tree?.unmount()); });

test('unsent text survives a screen/process remount and stays account-specific', async () => {
  await act(async () => { tree = create(<Capture storageKey={key} />); });
  act(() => result[1]({ text: 'Unsent message', city: '' }));
  await act(async () => tree.unmount());
  await act(async () => { tree = create(<Capture storageKey={key} />); });
  expect(result[0].text).toBe('Unsent message');
  await act(async () => { tree.update(<Capture storageKey={accountStorageKey('@mdp/test-draft', 'bob')} />); });
  expect(result[0].text).toBe('');
});

test('typing during restoration wins while untouched saved fields are retained', async () => {
  const get = jest.spyOn(AsyncStorage, 'getItem');
  let finish!: (value: string) => void;
  get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<Capture storageKey={key} />); });
  act(() => result[1](previous => ({ ...previous, text: 'New typing' })));
  await act(async () => { finish(JSON.stringify({ text: 'Old draft', city: 'Pune' })); });
  expect(result[0]).toEqual({ text: 'New typing', city: 'Pune' });
  expect(await readResumeValue(key)).toEqual(result[0]);
  get.mockRestore();
});

test('clearing a saved form cannot be undone by older writes or background events', async () => {
  let background!: (state: AppStateStatus) => void;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
    background = handler;
    return { remove: jest.fn() };
  });
  await act(async () => { tree = create(<Capture storageKey={key} />); });
  act(() => result[1]({ text: 'Draft', city: 'Pune' }));
  await act(async () => { await result[2](); });
  act(() => background('background'));
  expect(await readResumeValue(key)).toBeNull();
  listener.mockRestore();
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
