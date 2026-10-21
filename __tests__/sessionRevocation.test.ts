import { verifySessionRevocation } from '../src/services/SessionRevocationService';
import { get } from '../src/api/apiClient';
import { loadTokens } from '../src/utils/keychain';
import { decodeJwtPayload } from '../src/utils/jwt';

jest.mock('../src/api/apiClient', () => ({ get: jest.fn() }));
jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn() }));
jest.mock('../src/utils/jwt', () => ({ decodeJwtPayload: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'token' });
  (decodeJwtPayload as jest.Mock).mockReturnValue({ mdp_sid: 'current-session' });
});

test('delayed push for previous session never checks or logs out the new session', async () => {
  expect(await verifySessionRevocation({ session_id: 'previous-session' })).toBe(false);
  expect(get).not.toHaveBeenCalled();
});

test('matching push needs authoritative session_replaced response', async () => {
  (get as jest.Mock).mockResolvedValue({ active: true });
  expect(await verifySessionRevocation({ session_id: 'current-session' })).toBe(false);
  (get as jest.Mock).mockRejectedValue({ status: 0, isNetworkError: true });
  expect(await verifySessionRevocation({ session_id: 'current-session' })).toBe(false);
  (get as jest.Mock).mockRejectedValue({ status: 401, code: 'session_replaced' });
  expect(await verifySessionRevocation({ session_id: 'current-session' })).toBe(true);
});
