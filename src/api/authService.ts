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
  email: string; // Used in UI
  password: string;
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
  referral_code?: string;
}

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
 * Stores tokens securely in Keychain on success.
 */
export async function login(
  payload: LoginPayload,
  isCurrent: () => boolean = () => true,
): Promise<LoginResponse> {
  const backendPayload = {
    identifier: payload.email,
    password: payload.password,
  };

  const response = await post<unknown>('/auth/login/', backendPayload, false);

  // Handle Django backend envelope { data: { access, refresh, user }, success, message }
  const data = unwrapAuthResponse(response);

  assertAuthResponse(data);
  if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');
  await saveTokens(data.access, data.refresh, isCurrent);
  return data;
}

/**
 * Register a new account.
 * Stores tokens securely in Keychain on success.
 */
export async function register(
  payload: RegisterPayload,
  isCurrent: () => boolean = () => true,
): Promise<RegisterResponse> {
  const response = await post<unknown>('/auth/register/', {
    ...payload,
    mobile_number: payload.mobile,
    confirm_password: payload.password,
    accept_terms: payload.accept_terms === true,
  }, false);
  const data = unwrapAuthResponse(response);

  assertAuthResponse(data);
  if (!isCurrent()) throw new Error('Authentication was cancelled. Please try again.');
  await saveTokens(data.access, data.refresh, isCurrent);
  return data;
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
