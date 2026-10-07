import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { useProfileSearch } from '../src/hooks/useProfileSearch';
import { getDiscoverProfiles } from '../src/api/profileService';
jest.mock('../src/api/profileService', () => ({ getDiscoverProfiles: jest.fn() }));
let result: ReturnType<typeof useProfileSearch>;
let tree: ReactTestRenderer;
function Capture({ query }: { query: string }) {
  result = useProfileSearch(query, 'self');
  return null;
}
beforeEach(() => { jest.useFakeTimers(); jest.resetAllMocks(); });
afterEach(async () => { await act(async () => tree?.unmount()); jest.useRealTimers(); });
test('debounces typing and ignores an older search response', async () => {
  let finish!: (value: unknown) => void;
  (getDiscoverProfiles as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  await act(async () => { tree = create(<Capture query="old" />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  (getDiscoverProfiles as jest.Mock).mockResolvedValue({ profiles: [{ id: 'new' }], hasMore: false });
  await act(async () => { tree.update(<Capture query="n" />); });
  await act(async () => { tree.update(<Capture query="new" />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  await act(async () => { finish({ profiles: [{ id: 'old' }], hasMore: true }); });
  expect(getDiscoverProfiles).toHaveBeenCalledTimes(2);
  expect(result.profiles.map(profile => profile.id)).toEqual(['new']);
  expect(result.hasMore).toBe(false);
});
test('pagination deduplicates results and does not repeatedly fetch an empty list', async () => {
  (getDiscoverProfiles as jest.Mock)
    .mockResolvedValueOnce({ profiles: [{ id: 'one' }, { id: 'self' }], hasMore: true })
    .mockResolvedValueOnce({ profiles: [{ id: 'one' }, { id: 'two' }], hasMore: false });
  await act(async () => { tree = create(<Capture query="" />); });
  await act(async () => { await jest.advanceTimersByTimeAsync(300); });
  await act(async () => { await result.loadMore(); });
  expect(result.profiles.map(profile => profile.id)).toEqual(['one', 'two']);
  await act(async () => { await jest.advanceTimersByTimeAsync(10000); await result.loadMore(); });
  expect(getDiscoverProfiles).toHaveBeenCalledTimes(2);
});
