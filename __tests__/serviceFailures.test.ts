import { get, post, patch, upload } from '../src/api/apiClient';
import { verificationService } from '../src/api/verificationService';
import { settingsService } from '../src/api/settingsService';
import { blockService } from '../src/api/blockService';
import { resetPasswordWithOtp, forgotPassword } from '../src/api/authService';

jest.mock('../src/api/apiClient', () => ({
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  upload: jest.fn(),
}));
jest.mock('../src/utils/keychain', () => ({
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
}));
beforeEach(() => jest.resetAllMocks());
const failure = { status: 404, message: 'Endpoint unavailable' };

test('verification failures never manufacture verified status', async () => {
  (get as jest.Mock).mockRejectedValue(failure);
  (upload as jest.Mock).mockRejectedValue(failure);
  await expect(verificationService.getStatus()).rejects.toEqual(failure);
  await expect(
    verificationService.submitSelfie('file://selfie.jpg'),
  ).rejects.toEqual(failure);
  await expect(
    verificationService.submitDocument(
      'ID',
      'file://id.jpg',
      'id.jpg',
      'image/jpeg',
    ),
  ).rejects.toEqual(failure);
});
test('missing settings and block endpoints cannot report successful changes', async () => {
  (patch as jest.Mock).mockRejectedValue(failure);
  (post as jest.Mock).mockRejectedValue(failure);
  await expect(
    settingsService.updateSettings({ incognitoMode: true }),
  ).rejects.toEqual(failure);
  await expect(blockService.blockUser('profile')).rejects.toEqual(failure);
});
test('email password reset preserves email and never substitutes OTP login', async () => {
  (post as jest.Mock).mockRejectedValue(failure);
  await expect(
    resetPasswordWithOtp({
      identifier: 'person1234567890@example.com',
      code: '123456',
      new_password: 'replacement',
    }),
  ).rejects.toEqual(failure);
  expect(post).toHaveBeenCalledTimes(3);
  for (const [endpoint, body] of (post as jest.Mock).mock.calls) {
    expect(endpoint).not.toContain('/otp/verify/');
    expect(body.identifier).toBe('person1234567890@example.com');
    expect(body.mobile).toBeUndefined();
  }
});
test('invalid OTP does not fan out to alternate endpoints', async () => {
  (post as jest.Mock).mockRejectedValue({ status: 400 });
  await expect(
    resetPasswordWithOtp({
      identifier: '9876543210',
      code: 'bad',
      new_password: 'replacement',
    }),
  ).rejects.toEqual({ status: 400 });
  expect(post).toHaveBeenCalledTimes(1);
});
test('email containing digits is not treated as a phone number', async () => {
  await forgotPassword('person1234567890@example.com');
  expect(post).toHaveBeenCalledWith(
    '/auth/forgot-password/',
    expect.objectContaining({ email: 'person1234567890@example.com' }),
    false,
  );
});
