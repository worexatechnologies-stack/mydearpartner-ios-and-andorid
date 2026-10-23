import React from 'react';
import { act, create } from 'react-test-renderer';
import { Switch, TextInput } from 'react-native';
import SavedSearchControls from '../src/components/SavedSearchControls';
import { savedSearchService, savedSearchFilterKey } from '../src/api/savedSearchService';
import { savedSearchIdFromNotification } from '../src/utils/savedSearchNotification';

jest.mock('../src/api/savedSearchService', () => ({
  ...jest.requireActual('../src/api/savedSearchService'),
  savedSearchService: { create: jest.fn(), list: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock('../src/api/apiClient', () => ({}));
jest.mock('../src/api/profileService', () => ({}));
const service = savedSearchService as jest.Mocked<typeof savedSearchService>;
const id = 'aaaa1111-2222-3333-4444-555555555555';
const saved = { id, name: 'Nearby', filters: { city: 'Bengaluru' }, alerts_enabled: true, created_at: '', last_notified_at: null };

beforeEach(() => jest.clearAllMocks());

test('notification links require the correct type, local path and valid saved-search UUID', () => {
  expect(savedSearchIdFromNotification({ notification_type: 'SAVED_SEARCH_MATCH', url: `/search?saved_search=${id}` })).toBe(id);
  expect(savedSearchIdFromNotification({ type: 'SAVED_SEARCH_MATCH', saved_search_id: id })).toBe(id);
  expect(savedSearchIdFromNotification({ notification_type: 'MESSAGE', url: `/search?saved_search=${id}` })).toBeNull();
  expect(savedSearchIdFromNotification({ notification_type: 'SAVED_SEARCH_MATCH', url: `https://evil.test/search?saved_search=${id}` })).toBeNull();
  expect(savedSearchIdFromNotification({ notification_type: 'SAVED_SEARCH_MATCH', url: '/search?saved_search=bad' })).toBeNull();
});

test('filter comparison ignores key order and inactive filters', () => {
  expect(savedSearchFilterKey({ city: ' Bengaluru ', query: '', verified_only: false }))
    .toBe(savedSearchFilterKey({ city: 'Bengaluru' }));
  expect(savedSearchFilterKey({ city: 'Bengaluru', religion: 'Hindu' }))
    .toBe(savedSearchFilterKey({ religion: 'Hindu', city: 'Bengaluru' }));
});

test('saving defaults alerts off and sends the selected filters', async () => {
  service.create.mockResolvedValue(saved);
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SavedSearchControls accountId="one" filters={{ city: 'Bengaluru' }} quickSuggestionActive={false} onApply={jest.fn()} />); });
  await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Save search' })[0].props.onPress(); });
  expect(tree.root.findByType(Switch).props.value).toBe(false);
  await act(async () => { tree.root.findByType(TextInput).props.onChangeText(' Nearby '); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Confirm save search' }).props.onPress(); });
  expect(service.create).toHaveBeenCalledWith('Nearby', { city: 'Bengaluru' }, false);
  await act(async () => tree.unmount());
});

test('saved searches can be paused and deleted', async () => {
  service.list.mockResolvedValue([saved]);
  service.update.mockResolvedValue({ ...saved, alerts_enabled: false });
  service.remove.mockResolvedValue(undefined);
  const onRemove = jest.fn();
  let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(<SavedSearchControls accountId="one" filters={{}} quickSuggestionActive={false} onApply={jest.fn()} onRemove={onRemove} />); });
  await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Saved searches' })[0].props.onPress(); });
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Alerts for Nearby' }).props.onValueChange(false); });
  expect(service.update).toHaveBeenCalledWith(id, false);
  expect(tree.root.findByProps({ accessibilityLabel: 'Alerts for Nearby' }).props.value).toBe(false);
  await act(async () => { tree.root.findByProps({ accessibilityLabel: 'Delete Nearby' }).props.onPress(); });
  expect(service.remove).toHaveBeenCalledWith(id);
  expect(onRemove).toHaveBeenCalledWith(id);
  await act(async () => tree.unmount());
});

test('a previous account response cannot populate the new account list', async () => {
  let resolve!: (value: typeof saved[]) => void;
  service.list.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue([]);
  let tree!: ReturnType<typeof create>;
  const render = (accountId: string) => <SavedSearchControls accountId={accountId} filters={{}} quickSuggestionActive={false} onApply={jest.fn()} />;
  await act(async () => { tree = create(render('one')); });
  await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Saved searches' })[0].props.onPress(); });
  await act(async () => { tree.update(render('two')); resolve([saved]); });
  await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Saved searches' })[0].props.onPress(); });
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Delete Nearby' })).toHaveLength(0);
  await act(async () => tree.unmount());
});
