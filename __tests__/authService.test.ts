import { login, register, verifyOtp } from '../src/api/authService';
import { post } from '../src/api/apiClient';
import { saveTokens } from '../src/utils/keychain';
jest.mock('../src/api/apiClient', () => ({ post: jest.fn() }));
jest.mock('../src/utils/keychain', () => ({ saveTokens: jest.fn(), clearTokens: jest.fn() }));
const valid = { access: 'access', refresh: 'refresh', user: { id: 'member' } };
beforeEach(() => jest.clearAllMocks());
test.each([null, {}, { access: 'token' }, { ...valid, user: null }, { ...valid, refresh: 123 }])(
  'malformed login responses do not persist a partial session: %p', async response => {
    (post as jest.Mock).mockResolvedValue(response);
    await expect(login({ email: 'member@example.com', password: 'password' })).rejects.toThrow('complete sign-in');
    expect(saveTokens).not.toHaveBeenCalled();
  },
);
test.each([login, register])('cancelled authentication does not write credentials', async authenticate => {
  (post as jest.Mock).mockResolvedValue(valid);
  await expect(authenticate({ email: 'member@example.com', password: 'password' }, () => false)).rejects.toThrow('cancelled');
  expect(saveTokens).not.toHaveBeenCalled();
});
test('OTP verification validates the identity before saving tokens', async () => {
  (post as jest.Mock).mockResolvedValue({ access: 'access', refresh: 'refresh' });
  await expect(verifyOtp({ mobile: '9876543210', otp: '123456' })).rejects.toThrow('complete sign-in');
  expect(saveTokens).not.toHaveBeenCalled();
});
test('valid authentication persists tokens and returns the server identity', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await expect(login({ email: 'member@example.com', password: 'password' })).resolves.toEqual(valid);
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh', expect.any(Function));
});

test('registration maps native fields and transmits explicit consent to Django', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await register({ email: 'member@example.com', password: 'StrongPassword!742', mobile: '9876543210', accept_terms: true, policy_version: '2026-09-28' });
  expect(post).toHaveBeenCalledWith('/auth/register/', expect.objectContaining({
    mobile_number: '9876543210', confirm_password: 'StrongPassword!742', accept_terms: true, policy_version: '2026-09-28',
  }), false);
});

test('registration never manufactures consent when it is absent', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await register({ email: 'member@example.com', password: 'StrongPassword!742' });
  expect(post).toHaveBeenCalledWith('/auth/register/', expect.objectContaining({ accept_terms: false }), false);
});
