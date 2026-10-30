/**
 * MyDearPartner — Authentication Service
 *
 * Connects to the Django REST Framework auth endpoints.
 * Backend: https://mydearpartner.in/api/v1/auth/
 */

import { clearTokens,saveTokens } from '../utils/keychain';
import { post } from './apiClient';
import { LoginResponse,RegisterResponse } from './types';

function assertAuthResponse(data: unknown): asserts data is LoginResponse {
  const value = data as Partial<LoginResponse> | null;
  if (!value || typeof value.access !== 'string' || !value.access ||
      typeof value.refresh !== 'string' || !value.refresh ||
      !value.user || typeof value.user.id !== 'string' || !value.user.id) {
    throw new Error('We could not complete sign-in. Please try again.');
  }
}

function unwrapAuthResponse(response: unknown): unknown {
  return response && typeof response === 'object' && 'data' in response
    ? response.data : response;
}

export interface LoginPayload {
  email: string; // Email, mobile number, or member ID
  password: string;
}

interface LoginChallengeBase {
  requires_otp: true;
  phone_masked?: string;
  message?: string;
}

export type LoginChallengeResponse = LoginChallengeBase & (
  | { challenge_id: string; requires_two_factor?: never; mobile_number?: never }
  | { requires_two_factor: true; mobile_number: string; challenge_id?: never }
);

export type LoginResult = LoginResponse | LoginChallengeResponse;

function parseLoginChallenge(response: unknown): LoginChallengeResponse {
  const data = unwrapAuthResponse(response) as Record<string, unknown> | null;
  if (data && data.requires_otp === true && typeof data.challenge_id === 'string' && data.challenge_id.trim()) {
    return {
      requires_otp: true,
      challenge_id: data.challenge_id,
      phone_masked: typeof data.phone_masked === 'string' ? data.phone_masked : undefined,
      message: typeof data.message === 'string' ? data.message : undefined,
    };
  }
  // The complete backend uses TWO_FACTOR challenges identified by the registered
  // mobile returned after password validation, rather than an opaque UUID.
  if (data && data.requires_two_factor === true && typeof data.mobile_number === 'string') {
    const digits = data.mobile_number.replace(/[\s()+.-]/g, '');
    const mobile = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (/^[6-9][0-9]{9}$/.test(mobile)) {
      return {
        requires_otp: true,
        requires_two_factor: true,
        mobile_number: mobile,
        phone_masked: `******${mobile.slice(-4)}`,
        message: typeof data.message === 'string' ? data.message : undefined,
      };
    }
  }
  throw new Error('OTP sign-in is temporarily unavailable. Please try again later or contact support.');
}

export interface RegisterPayload {
  email: string;
  password: string;
  date_of_birth?: string;
  policy_version?: string;
  accept_terms?: boolean;
  mobile?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  profile_created_by?: string;
  referral_code?: string;
}

export type RegisterResult = RegisterResponse | LoginChallengeResponse;

export interface OtpSendPayload {
  mobile: string;
}

export interface OtpVerifyPayload {
  mobile: string;
  otp: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

/**
 * Login with email (or mobile) + password.
 * Maps 'email' to 'identifier' for the Django backend.
 * Returns either an authenticated session (when OTP is not required) or an OTP challenge.
 */
export async function login(
  payload: LoginPayload,
  isCurrent: () => boolean = () => true,
): Promise<LoginResult> {
  const backendPayload = {
    identifier: payload.email,
    password: payload.password,
  };

  const response = await post<unknown>('/auth/login/', backendPayload, false);

  // Both API response envelopes and direct challenge responses are supported.
  const data = unwrapAuthResponse(response) as Record<string, unknown> | null;

  if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');

  // If the backend returns tokens directly (e.g. demo/reviewer account where 2FA is bypassed)
  if (data && (data.requires_two_factor === false || data.requires_otp === false || (typeof data.access === 'string' && data.access && typeof data.refresh === 'string' && data.refresh && Boolean(data.user && typeof data.user === 'object' && (data.user as any).id)))) {
    assertAuthResponse(data);
    await saveTokens(data.access, data.refresh, isCurrent);
    return data;
  }

  return parseLoginChallenge(data);
}

export async function verifyLoginOtp(
  payload: { challenge_id: string; otp: string } | { mobile_number: string; otp: string },
  isCurrent: () => boolean = () => true,
): Promise<LoginResponse> {
  const response = 'mobile_number' in payload
    ? await post<unknown>('/auth/otp/verify/', {
      identifier: payload.mobile_number,
      code: payload.otp.trim(),
      purpose: 'TWO_FACTOR',
    }, false)
    : await post<unknown>('/auth/login/verify/', {
      challenge_id: payload.challenge_id,
      otp: payload.otp.trim(),
    }, false);
  const data = unwrapAuthResponse(response);
  assertAuthResponse(data);
  if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');
  await saveTokens(data.access, data.refresh, isCurrent);
  return data;
}

export async function resendLoginOtp(challengeId: string): Promise<LoginChallengeResponse> {
  const response = await post<unknown>('/auth/login/resend-otp/', {
    challenge_id: challengeId,
  }, false);
  return parseLoginChallenge(response);
}

/**
 * Register a new account.
 * Stores tokens securely in Keychain on success.
 */
export async function register(
  payload: RegisterPayload,
  isCurrent: () => boolean = () => true,
): Promise<RegisterResult> {
  const normalizedGender = typeof payload.gender === 'string' ? payload.gender.trim().toLowerCase() : undefined;
  const gender = normalizedGender
    ? normalizedGender.charAt(0).toUpperCase() + normalizedGender.slice(1)
    : undefined;
  const response = await post<unknown>('/member-auth/register/', {
    ...payload,
    ...(gender ? { gender } : {}),
    mobile_number: payload.mobile,
    confirm_password: payload.password,
    accept_terms: payload.accept_terms === true,
  }, false);
  const data = unwrapAuthResponse(response);
  const value = data as (Partial<RegisterResponse> & { access?: string }) | null;
  if (!value) throw new Error('The server returned an invalid registration response. Please try again.');
  if (typeof value.access !== 'string' || !value.access) {
    // The production web registration endpoint authenticates with cookies and
    // returns the created user in JSON. Native clients need a bearer session,
    // so exchange the just-created credentials through the normal login flow.
    if (value.user && typeof value.user === 'object') {
      return login({ email: payload.email, password: payload.password }, isCurrent);
    }
    throw new Error('The account response did not confirm creation. Please try again or sign in.');
  }
  if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');
  await saveTokens(value.access, value.refresh ?? null, isCurrent);
  // Member registration may return only an access token; the app loads the
  // authenticated profile to establish the complete user identity.
  return {
    ...value,
    user: value.user ?? { id: '' },
  } as RegisterResponse;
}

export interface ResetPasswordPayload {
  identifier: string;
  code: string;
  new_password: string;
  confirm_password?: string;
}

/**
 * Send OTP to mobile number via Renflair SMS provider.
 */
export async function sendOtp(mobile: string): Promise<any> {
  const digits = mobile.replace(/\D/g, '');
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;

  const payload = {
    mobile: tenDigits,
    phone: tenDigits,
    mobile_number: `+91${tenDigits}`,
    identifier: tenDigits,
  };

  try {
    return await post<any>('/auth/otp/send/', payload, false);
  } catch (err: any) {
    // Try a legacy route only when the primary route is absent.
    if (![404, 405].includes(err?.status)) throw err;
    try {
      return await post<any>('/auth/forgot-password/', payload, false);
    } catch {
      throw err;
    }
  }
}

/**
 * Verify OTP and log in.
 */
export async function verifyOtp(
  payload: OtpVerifyPayload,
): Promise<LoginResponse> {
  const response = await post<unknown>('/auth/otp/verify/', payload, false);
  const data = unwrapAuthResponse(response);

  assertAuthResponse(data);
  await saveTokens(data.access, data.refresh);
  return data;
}

/**
 * Logout — clear tokens from Keychain and notify backend.
 */
export async function logout(): Promise<void> {
  try {
    await post('/auth/logout/', {});
  } catch {
    // Backend logout failure is non-critical — always clear local tokens
  } finally {
    await clearTokens();
  }
}

/**
 * Change password.
 */
export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<void> {
  await post('/auth/password/change/', payload);
}

/**
 * Request a password reset OTP (forgot password).
 * Accepts email or mobile as 'identifier'.
 */
export async function forgotPassword(identifier: string): Promise<any> {
  const clean = identifier.trim();
  const digits = clean.replace(/\D/g, '');
  const isMobile = !clean.includes('@') && digits.length >= 10;

  if (isMobile) {
    return await sendOtp(digits);
  }

  return await post<any>(
    '/auth/forgot-password/',
    { identifier: clean, email: clean },
    false,
  );
}

/**
 * Reset password using OTP code.
 */
export async function resetPasswordWithOtp(
  payload: ResetPasswordPayload,
): Promise<any> {
  const clean = payload.identifier.trim();
  const digits = clean.replace(/\D/g, '');
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;

  const isEmail = clean.includes('@');
  const body: Record<string, string> = {
    identifier: isEmail ? clean : tenDigits,
    ...(isEmail
      ? { email: clean }
      : {
          mobile: tenDigits,
          mobile_number: `+91${tenDigits}`,
          phone: tenDigits,
        }),
    code: payload.code.trim(),
    otp: payload.code.trim(),
    token: payload.code.trim(),
    new_password: payload.new_password,
    password: payload.new_password,
    confirm_password: payload.confirm_password || payload.new_password,
  };

  const endpoints = [
    '/auth/reset-password/',
    '/auth/password-reset/confirm/',
    '/auth/password/reset/',
  ];
  for (const endpoint of endpoints) {
    try {
      return await post<any>(endpoint, body, false);
    } catch (error: any) {
      if (
        ![404, 405].includes(error?.status) ||
        endpoint === endpoints[endpoints.length - 1]
      )
        throw error;
    }
  }
}
