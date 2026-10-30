import { login, register, verifyOtp, verifyLoginOtp, resendLoginOtp } from '../src/api/authService';
import { post } from '../src/api/apiClient';
import { saveTokens } from '../src/utils/keychain';
jest.mock('../src/api/apiClient', () => ({ post: jest.fn() }));
jest.mock('../src/utils/keychain', () => ({ saveTokens: jest.fn(), clearTokens: jest.fn() }));
const valid = { access: 'access', refresh: 'refresh', user: { id: 'member' } };
beforeEach(() => jest.clearAllMocks());
test.each([null, {}, { access: 'token' }, { ...valid, user: null }, { ...valid, refresh: 123 }])(
  'malformed login responses do not persist a partial session: %p', async response => {
    (post as jest.Mock).mockResolvedValue(response);
    await expect(login({ email: 'member@example.com', password: 'password' })).rejects.toThrow('OTP sign-in');
    expect(saveTokens).not.toHaveBeenCalled();
  },
);
test.each([register, verifyLoginOtp])('cancelled authentication does not write credentials', async authenticate => {
  (post as jest.Mock).mockResolvedValue(valid);
  await expect(authenticate({ email: 'member@example.com', password: 'password', challenge_id: 'challenge', otp: '123456' }, () => false)).rejects.toThrow('cancelled');
  expect(saveTokens).not.toHaveBeenCalled();
});
test('OTP verification validates the identity before saving tokens', async () => {
  (post as jest.Mock).mockResolvedValue({ access: 'access', refresh: 'refresh' });
  await expect(verifyOtp({ mobile: '9876543210', otp: '123456' })).rejects.toThrow('complete sign-in');
  expect(saveTokens).not.toHaveBeenCalled();
});
test('verified authentication persists tokens and returns the server identity', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await expect(verifyLoginOtp({ challenge_id: 'challenge', otp: '123456' })).resolves.toEqual(valid);
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh', expect.any(Function));
});

test('registration maps native fields, including gender, and transmits explicit consent to Django', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await register({ email: 'member@example.com', password: 'StrongPassword!742', mobile: '9876543210', gender: 'female', profile_created_by: 'Friend', accept_terms: true, policy_version: '2026-09-28' });
  expect(post).toHaveBeenCalledWith('/member-auth/register/', expect.objectContaining({
    mobile_number: '9876543210', confirm_password: 'StrongPassword!742', gender: 'Female', profile_created_by: 'Friend', accept_terms: true, policy_version: '2026-09-28',
  }), false);
});

test('registration never manufactures consent when it is absent', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await register({ email: 'member@example.com', password: 'StrongPassword!742' });
  expect(post).toHaveBeenCalledWith('/member-auth/register/', expect.objectContaining({ accept_terms: false }), false);
});

test('registration accepts token-only responses and saves the session', async () => {
  (post as jest.Mock).mockResolvedValue({ access: 'access', refresh: 'refresh' });
  await expect(register({ email: 'member@example.com', password: 'StrongPassword!742', gender: 'female' }))
    .resolves.toMatchObject({ access: 'access', refresh: 'refresh' });
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh', expect.any(Function));
});

test('cookie-only registration exchanges credentials and returns native OTP challenge', async () => {
  (post as jest.Mock)
    .mockResolvedValueOnce({ user: { id: 'new-member' }, session_id: 'session' })
    .mockResolvedValueOnce({ requires_two_factor: true, mobile_number: '9876543210' });
  await expect(register({
    email: 'member@example.com', password: 'StrongPassword!742', mobile: '9876543210',
  })).resolves.toMatchObject({
    requires_otp: true,
    requires_two_factor: true,
    mobile_number: '9876543210',
  });
  expect(post).toHaveBeenNthCalledWith(2, '/auth/login/', {
    identifier: 'member@example.com', password: 'StrongPassword!742',
  }, false);
  expect(saveTokens).not.toHaveBeenCalled();
});

const challenge = { requires_otp: true, challenge_id: 'opaque-challenge', phone_masked: '******3210' };
test('password login requests an OTP without persisting tokens', async () => {
  (post as jest.Mock).mockResolvedValue({ data: challenge });
  await expect(login({ email: 'MDP123', password: 'password' })).resolves.toEqual(challenge);
  expect(post).toHaveBeenCalledWith('/auth/login/', { identifier: 'MDP123', password: 'password' }, false);
  expect(saveTokens).not.toHaveBeenCalled();
});
test('direct password login with tokens succeeds and saves tokens without OTP', async () => {
  (post as jest.Mock).mockResolvedValue({ data: valid });
  await expect(login({ email: 'member', password: 'password' })).resolves.toEqual(valid);
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh', expect.any(Function));
});
test.each([{ requires_otp: true }, { requires_otp: true, challenge_id: '' }])(
  'login fails closed without a valid challenge: %p', async response => {
    (post as jest.Mock).mockResolvedValue(response);
    await expect(login({ email: 'member', password: 'password' })).rejects.toThrow('OTP sign-in');
    expect(saveTokens).not.toHaveBeenCalled();
  },
);
test('resend replaces the opaque challenge without credentials or tokens', async () => {
  (post as jest.Mock).mockResolvedValue(challenge);
  await expect(resendLoginOtp('previous-challenge')).resolves.toEqual(challenge);
  expect(post).toHaveBeenCalledWith('/auth/login/resend-otp/', { challenge_id: 'previous-challenge' }, false);
  expect(saveTokens).not.toHaveBeenCalled();
});
test('failed OTP verification cannot fall back to another login endpoint', async () => {
  (post as jest.Mock).mockRejectedValue({ status: 404 });
  await expect(verifyLoginOtp({ challenge_id: 'challenge', otp: '123456' })).rejects.toEqual({ status: 404 });
  expect(post).toHaveBeenCalledTimes(1);
  expect(saveTokens).not.toHaveBeenCalled();
});

test.each(['9876543210', '+91 9876543210', '919876543210'])(
  'current backend TWO_FACTOR challenge opens OTP entry for %s without saving tokens', async mobile => {
    (post as jest.Mock).mockResolvedValue({ success: true, data: {
      requires_two_factor: true, mobile_number: mobile, expires_in: 300,
    } });
    await expect(login({ email: 'member@example.com', password: 'password' })).resolves.toEqual({
      requires_otp: true, requires_two_factor: true,
      mobile_number: '9876543210', phone_masked: '******3210',
    });
    expect(saveTokens).not.toHaveBeenCalled();
  },
);

test.each([undefined, '', '12345', 'not-a-phone', '1234567890123'])(
  'incomplete TWO_FACTOR destination is rejected: %p', async mobile => {
    (post as jest.Mock).mockResolvedValue({ requires_two_factor: true, mobile_number: mobile });
    await expect(login({ email: 'member', password: 'password' })).rejects.toThrow('OTP sign-in');
    expect(saveTokens).not.toHaveBeenCalled();
  },
);

test('current backend verification submits the server-returned mobile and TWO_FACTOR purpose', async () => {
  (post as jest.Mock).mockResolvedValue({ success: true, data: valid });
  await expect(verifyLoginOtp({ mobile_number: '9876543210', otp: ' 123456 ' })).resolves.toEqual(valid);
  expect(post).toHaveBeenCalledWith('/auth/otp/verify/', {
    identifier: '9876543210', code: '123456', purpose: 'TWO_FACTOR',
  }, false);
  expect(saveTokens).toHaveBeenCalledWith('access', 'refresh', expect.any(Function));
});

test('cancelled current-backend verification cannot persist tokens', async () => {
  (post as jest.Mock).mockResolvedValue(valid);
  await expect(verifyLoginOtp({ mobile_number: '9876543210', otp: '123456' }, () => false)).rejects.toThrow('cancelled');
  expect(saveTokens).not.toHaveBeenCalled();
});

test('incorrect current-backend OTP never stores tokens or falls back to password-only login', async () => {
  (post as jest.Mock).mockRejectedValue({ status: 400, message: 'Invalid or expired verification code.' });
  await expect(verifyLoginOtp({ mobile_number: '9876543210', otp: '111111' })).rejects.toMatchObject({ status: 400 });
  expect(post).toHaveBeenCalledTimes(1);
  expect(saveTokens).not.toHaveBeenCalled();
});
