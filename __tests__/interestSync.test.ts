import { fetchInterestSnapshot } from '../src/services/InterestSyncService';
import {
  getReceivedInterests,
  getSentInterests,
} from '../src/api/interestService';
jest.mock('../src/api/interestService', () => ({
  getReceivedInterests: jest.fn(),
  getSentInterests: jest.fn(),
}));
test('received alerts do not wait for a slow sent-interest request', async () => {
  let resolveSent: (value: unknown[]) => void = () => {};
  (getSentInterests as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      resolveSent = resolve;
    }),
  );
  (getReceivedInterests as jest.Mock).mockResolvedValue([{ id: 'new' }]);
  const onReceived = jest.fn();
  const pending = fetchInterestSnapshot(onReceived);
  await Promise.resolve();
  expect(onReceived).toHaveBeenCalledWith([{ id: 'new' }]);
  resolveSent([]);
  await pending;
});
test('sent-list failure does not discard incoming interests', async () => {
  (getSentInterests as jest.Mock).mockRejectedValue(new Error('offline'));
  (getReceivedInterests as jest.Mock).mockResolvedValue([{ id: 'new' }]);
  const result = await fetchInterestSnapshot(jest.fn());
  expect(result.received).toEqual([{ id: 'new' }]);
  expect(result.sent).toBeUndefined();
});
