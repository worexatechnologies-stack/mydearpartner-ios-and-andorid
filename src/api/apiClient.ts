import { reportApiReachability } from '../services/ConnectivityService';
/**
 * MyDearPartner — Central API Client
 *
 * Production backend: Django REST Framework at https://mydearpartner.in/api/v1
 */

import { REQUEST_TIMEOUT_MS } from '../config/constants';
import { API_BASE_URL } from '../config/env';
import { StoredCredentials,clearTokens,clearTokensForSession,loadTokens,saveTokens } from '../utils/keychain';
import { markMessagingCryptoLoggedOut } from '../services/MessagingCryptoLifecycle';
import { saveSessionReplacedNotice } from '../services/SessionNoticeService';
import { ApiError as IApiError } from './types';

class ApiError extends Error implements IApiError {
  code?: string;
  status: number;
  detail?: string | Record<string, string[]>;
  isNetworkError?: boolean;
  isAuthError?: boolean;

  constructor(
    status: number,
    message: string,
    detail?: string | Record<string, string[]>,
    isAuthError?: boolean,
    isNetworkError?: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
    this.isAuthError = isAuthError;
    this.isNetworkError = isNetworkError;
  }
}

let refreshPromise: Promise<string | null> | null = null;
let _onUnauthenticated: ((reason?: 'session_replaced') => void) | null = null;

export function registerUnauthenticatedHandler(handler: (reason?: 'session_replaced') => void) {
  _onUnauthenticated = handler;
  return () => { if (_onUnauthenticated === handler) _onUnauthenticated = null; };
}

async function rejectReplacedSession(error: ApiError, stored: StoredCredentials | null): Promise<void> {
  if (error.status !== 401 || error.code !== 'session_replaced' || !stored) return;
  if (await clearTokensForSession(stored)) {
    if (await loadTokens()) throw error;
    markMessagingCryptoLoggedOut();
    // No backend logout call: that could revoke the new device's session.
    try { await saveSessionReplacedNotice(); } catch { /* In-memory handler still signs out. */ }
    if (!(await loadTokens())) _onUnauthenticated?.('session_replaced');
  }
  throw error;
}

/**
 * B2 — Map raw Django/server error strings to user-friendly messages.
 * This prevents internal field names and stack-trace fragments from
 * reaching the end user.
 */
function friendlyMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (!raw.trim() || /traceback|stack trace|(?:database|sql|syntax|type|key|attribute)error|exception:|\bat \S+ \(.+:\d+/.test(lower)) return 'The request could not be completed. Please try again.';
  if (lower.includes('receiver_id') || lower.includes('receiver')) return 'Could not send request. Please try again.';
  if (lower.includes('token') && lower.includes('invalid')) return 'Session expired. Please log in again.';
  if (lower.includes('unique') || lower.includes('already exists')) return 'This action has already been performed.';
  if (lower.includes('not found') || lower.includes('no matching query')) return 'The requested item no longer exists.';
  if (lower.includes('permission') || lower.includes('not allowed')) return 'You do not have permission to do that.';
  if (lower.includes('throttl') || lower.includes('rate limit')) return 'Too many requests. Please wait a moment and try again.';
  if (lower.includes('timed out') || lower.includes('timeout')) return 'Request timed out. Check your connection and try again.';
  if (lower.includes('connect') || lower.includes('network')) return 'Could not connect. Please check your internet connection.';
  // Return original if no mapping found — it may already be user-facing
  return raw;
}

/** Bound the whole response read, abort slow requests, and always release timers. */
async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(
            new ApiError(
              0,
              'Request timed out. Please try again.',
              undefined,
              false,
              true,
            ),
          );
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function buildApiError(res: Response): Promise<ApiError> {
  let detail: string | Record<string, string[]> | undefined;
  let parsedMessage = '';
  let code: string | undefined;
  try {
    const body = (await res.json()) as Record<string, unknown>;

    const payload = body.data as Record<string, unknown> | undefined;
    const rawCode = body.code ?? payload?.code;
    if (typeof rawCode === 'string') code = rawCode;
    const errors = body.errors as Record<string, string[]> | undefined;
    if (errors && Object.keys(errors).length > 0) {
      const firstKey = Object.keys(errors)[0];
      if (Array.isArray(errors[firstKey]) && errors[firstKey].length > 0) {
        parsedMessage = `Field "${firstKey}": ${errors[firstKey][0]}`;
      }
    }

    const raw = body.detail ?? body.message ?? body.error;
    detail = typeof raw === 'string' ? raw : (raw as Record<string, string[]>);

    if (!parsedMessage && typeof detail === 'string') {
      parsedMessage = detail;
    }

    // Check root-level Django field errors (e.g., { receiver: ["Daily limit reached."] })
    if (!parsedMessage && typeof body === 'object' && body !== null) {
      for (const [key, val] of Object.entries(body)) {
        if (key === 'success' || key === 'code' || key === 'status') continue;
        if (
          Array.isArray(val) &&
          val.length > 0 &&
          typeof val[0] === 'string'
        ) {
          parsedMessage = val[0];
          break;
        } else if (typeof val === 'string') {
          parsedMessage = val;
          break;
        }
      }
    }

    if (!parsedMessage) {
      parsedMessage = 'An error occurred.';
    }
  } catch {
    parsedMessage = res.statusText;
  }
  const error = new ApiError(
    res.status,
    res.status >= 500 ? 'The service is temporarily unavailable. Please try again.' : friendlyMessage(parsedMessage),
    detail,
    res.status === 401 || res.status === 403,
  );
  error.code = code;
  return error;
}

async function attemptTokenRefresh(): Promise<string | null> {
  const stored = await loadTokens();
  if (!stored?.refreshToken) {
    if (stored?.accessToken) {
      const current = await loadTokens();
      if (current?.accessToken !== stored.accessToken) {
        throw new ApiError(401, 'Session changed. Please try again.', undefined, true);
      }
      await clearTokens();
      _onUnauthenticated?.();
    }
    return null;
  }
  return withTimeout(async signal => {
    const res = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json', 'X-MDP-Client': 'native' },
      body: JSON.stringify({ refresh: stored.refreshToken }),
    });
    if (res.status === 401 || res.status === 403) {
      const error = await buildApiError(res);
      await rejectReplacedSession(error, stored);
      const current = await loadTokens();
      if (current?.refreshToken !== stored.refreshToken) {
        throw new ApiError(401, 'Session changed. Please try again.', undefined, true);
      }
      await clearTokens();
      _onUnauthenticated?.();
      return null;
    }
    if (!res.ok) throw await buildApiError(res);
    const raw = await res.json();
    const data = raw?.data ?? raw;
    if (typeof data?.access !== 'string' || !data.access) {
      throw new ApiError(res.status, 'Invalid token refresh response.');
    }
    const current = await loadTokens();
    if (current?.refreshToken !== stored.refreshToken) {
      throw new ApiError(
        401,
        'Session changed. Please try again.',
        undefined,
        true,
      );
    }
    await saveTokens(data.access, data.refresh ?? stored.refreshToken);
    return data.access;
  });
}

function refreshSession(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = attemptTokenRefresh()
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Never attach credentials to external pagination/media URLs. */
function apiUrl(endpoint: string): string {
  const base = new URL(API_BASE_URL);
  const url = new URL(endpoint.startsWith('/') ? `${API_BASE_URL}${endpoint}` : endpoint);
  if (url.origin !== base.origin || !url.pathname.startsWith(`${base.pathname}/`) ||
      url.username || url.password || url.protocol !== 'https:') {
    throw new ApiError(0, 'Invalid API endpoint.');
  }
  return url.toString();
}

/** A delayed response/retry from account A must never run as account B. */
async function assertSessionUnchanged(started: StoredCredentials | null): Promise<void> {
  const current = await loadTokens();
  if (current?.refreshToken !== started?.refreshToken ||
      (!started?.refreshToken && current?.accessToken !== started?.accessToken)) {
    throw new ApiError(401, 'Session changed. Please try again.', undefined, true);
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuth = true,
  _retryCount = 0, // B3: retry counter for network errors
): Promise<T> {
  const url = apiUrl(endpoint);
  const stored = await loadTokens();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-MDP-Client': 'native',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    ...(options.headers as Record<string, string>),
  };
  if (stored?.accessToken)
    headers.Authorization = `Bearer ${stored.accessToken}`;
  let res: Response;
  let responseText: string;
  try {
    const result = await withTimeout(async signal => {
      const response = await fetch(url, { ...options, headers, signal });
      return { response, text: await response.text() };
    });
    reportApiReachability(true);
    res = result.response;
    responseText = result.text;
  } catch (err) {
    await assertSessionUnchanged(stored);
    reportApiReachability(false);
    if (err instanceof ApiError) {
      // B3: Retry network / timeout errors up to 2 times with backoff
      if (err.isNetworkError && (options.method ?? 'GET') === 'GET' && _retryCount < 2) {
        await new Promise<void>(resolve => setTimeout(resolve, 500 * (_retryCount + 1)));
        await assertSessionUnchanged(stored);
        return request<T>(endpoint, options, retryOnAuth, _retryCount + 1);
      }
      throw err;
    }
    throw new ApiError(
      0,
      'Could not connect. Please check your connection and try again.',
      undefined,
      false,
      true,
    );
  }
  await assertSessionUnchanged(stored);
  if (res.status === 401) {
    const error = await buildApiError({ status: res.status, statusText: res.statusText,
      json: async () => JSON.parse(responseText) } as Response);
    await rejectReplacedSession(error, stored);
  }
  if (res.status === 401 && retryOnAuth) {
    const newToken = await refreshSession();
    if (!newToken)
      throw new ApiError(
        401,
        'Session expired. Please log in again.',
        undefined,
        true,
        false,
      );
    return request<T>(endpoint, options, false);
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    throw await buildApiError({
      status: res.status,
      statusText: res.statusText,
      json: async () => JSON.parse(responseText),
    } as Response);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new ApiError(res.status, 'Invalid response from server.');
  }
  if (parsed && typeof parsed === 'object' && parsed.success === false) {
    throw new ApiError(
      res.status,
      typeof parsed.message === 'string'
        ? friendlyMessage(parsed.message)
        : 'The request could not be completed.',
    );
  }
  if (
    parsed &&
    typeof parsed === 'object' &&
    'success' in parsed &&
    'data' in parsed
  )
    return parsed.data as T;
  return parsed as T;
}

export async function get<T>(endpoint: string, retryOnAuth = true): Promise<T> {
  return request<T>(endpoint, { method: 'GET' }, retryOnAuth);
}

export async function post<T>(
  endpoint: string,
  body?: unknown,
  retryOnAuth = true,
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    retryOnAuth,
  );
}

export async function patch<T>(
  endpoint: string,
  body: unknown,
  retryOnAuth = true,
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
    retryOnAuth,
  );
}

export async function put<T>(
  endpoint: string,
  body: unknown,
  retryOnAuth = true,
): Promise<T> {
  return request<T>(
    endpoint,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
    retryOnAuth,
  );
}

export async function del<T = void>(
  endpoint: string,
  retryOnAuth = true,
): Promise<T> {
  return request<T>(endpoint, { method: 'DELETE' }, retryOnAuth);
}

/**
 * Multipart photo upload.
 * Uses XMLHttpRequest which has better RN FormData support than fetch.
 */
export async function upload<T>(
  endpoint: string,
  formData: FormData,
  method: string = 'POST',
  retryOnAuth = true,
): Promise<T> {
  const stored = await loadTokens();
  const token = stored?.accessToken ?? null;
  const url = apiUrl(endpoint);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('X-MDP-Client', 'native');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
    xhr.timeout = 60000;

    xhr.onload = () => {
      assertSessionUnchanged(stored).then(() => handleLoad()).catch(reject);
    };

    const handleLoad = async () => {
      if (xhr.status === 401) {
        const error = await buildApiError({ status: xhr.status, statusText: 'Session expired.',
          json: async () => JSON.parse(xhr.responseText) } as Response);
        try { await rejectReplacedSession(error, stored); } catch (revoked) { reject(revoked); return; }
      }
      if (xhr.status === 401 && retryOnAuth) {
        refreshSession().then(newToken => {
          if (!newToken) throw new ApiError(401, 'Session expired. Please log in again.', undefined, true);
          return upload<T>(endpoint, formData, method, false);
        }).then(resolve, reject);
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        if (xhr.status === 204) { resolve(undefined as T); return; }
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (parsed?.success === false) {
            reject(new ApiError(xhr.status, typeof parsed.message === 'string' ? friendlyMessage(parsed.message) : 'Upload failed.'));
            return;
          }
          if (
            parsed &&
            typeof parsed === 'object' &&
            'success' in parsed &&
            'data' in parsed
          ) {
            resolve(parsed.data as T);
          } else {
            resolve(parsed as T);
          }
        } catch {
          reject({
            status: xhr.status,
            message: 'Invalid upload response.',
          } as ApiError);
        }
      } else {
        buildApiError({
          status: xhr.status,
          statusText: 'Upload failed. Please try again.',
          json: async () => JSON.parse(xhr.responseText),
        } as Response).then(reject, reject);
      }
    };

    xhr.onerror = () => {
      reject({
        status: 0,
        message: 'Upload failed. Check your connection.',
        isNetworkError: true,
      } as ApiError);
    };

    xhr.ontimeout = () => {
      reject({
        status: 0,
        message: 'Upload timed out.',
        isNetworkError: true,
      } as ApiError);
    };

    xhr.send(formData);
  });
}

export default { get, post, patch, put, del, upload };
