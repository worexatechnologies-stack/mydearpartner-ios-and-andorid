import { blockService } from '../src/api/blockService';
import { get } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), post: jest.fn(), del: jest.fn() }));
afterEach(() => jest.clearAllMocks());
test.each([true, false])('uses an explicit server block result: %s', async blocked => {
  (get as jest.Mock).mockResolvedValue({ blocked });
  expect(await blockService.checkIfBlockedBy('a&b')).toBe(blocked);
  expect(get).toHaveBeenCalledWith('/blocks/check/?profile_id=a%26b');
});
test.each([{ status: 404 }, { status: 403 }, { status: 0 }, new Error('timeout')])('an unavailable check remains unknown', async error => {
  (get as jest.Mock).mockRejectedValue(error);
  expect(await blockService.checkIfBlockedBy('other')).toBeNull();
});
test('malformed responses do not confirm that a user is unblocked', async () => {
  (get as jest.Mock).mockResolvedValue({ blocked: 'false' });
  expect(await blockService.checkIfBlockedBy('other')).toBeNull();
});
