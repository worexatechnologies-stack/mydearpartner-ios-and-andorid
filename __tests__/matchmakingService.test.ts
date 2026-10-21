import { getMatchCapabilities, getMatchInsights, matchInsightsFailure } from '../src/api/matchmakingService';
import { get, post } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), post: jest.fn() }));
const result = { candidateId: 'candidate', compatibilityScore: null, isAiEnhanced: false, summary: 'No score', explanation: 'Missing facts', sharedStrengths: [], considerations: [], dataCompleteness: 0 };
beforeEach(() => jest.clearAllMocks());
test('requests authenticated server-resolved candidate insights without sending profile data', async () => {
  (post as jest.Mock).mockResolvedValueOnce(result);
  await expect(getMatchInsights('candidate', true)).resolves.toEqual(result);
  expect(post).toHaveBeenCalledWith('/matches/compatibility/', { candidateId: 'candidate', useAi: true });
});
test.each([
  { ...result, candidateId: 'other' }, { ...result, compatibilityScore: 110 },
  { ...result, sharedStrengths: [{ fake: 'fact' }] }, { ...result, isAiEnhanced: 'true' },
])('rejects malformed or mismatched server results', async value => {
  (post as jest.Mock).mockResolvedValueOnce(value);
  await expect(getMatchInsights('candidate')).rejects.toThrow('unavailable');
});

test('availability validates the service contract instead of treating a generic 200 as ready', async () => {
  (get as jest.Mock).mockResolvedValueOnce({ service: 'match-insights', version: 1, aiConfigured: false });
  await expect(getMatchCapabilities()).resolves.toMatchObject({ aiConfigured: false });
  (get as jest.Mock).mockResolvedValueOnce({ status: 'ok' });
  await expect(getMatchCapabilities()).rejects.toThrow('unavailable');
});
test('request errors distinguish unavailable services from rate limits', () => {
  expect(matchInsightsFailure({ status: 404 })).toContain('currently unavailable');
  expect(matchInsightsFailure({ status: 429 })).toContain('wait a minute');
  expect(matchInsightsFailure({ status: 401 })).toContain('sign in again');
  expect(matchInsightsFailure({ status: 0 })).toContain('connection');
});
