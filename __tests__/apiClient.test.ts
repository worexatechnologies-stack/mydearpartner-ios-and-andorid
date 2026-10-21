jest.mock('../src/services/SessionNoticeService', () => ({ saveSessionReplacedNotice: jest.fn().mockResolvedValue(undefined) }));
import { get, registerUnauthenticatedHandler } from '../src/api/apiClient';
import { loadTokens, saveTokens, clearTokens } from '../src/utils/keychain';
jest.mock('../src/utils/keychain', () => ({
  loadTokens: jest.fn(),
  saveTokens: jest.fn(),
  clearTokens: jest.fn(),
  clearTokensForSession: jest.fn(),
}));
const response = (status: number, body: any) => ({
  status,
  ok: status < 400,
  text: async () => JSON.stringify(body),
  json: async () => body,
});
const originalFetch = global.fetch;
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (loadTokens as jest.Mock).mockResolvedValue({
    accessToken: 'old',
    refreshToken: 'refresh',
  });
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});
test('success unwraps envelopes and releases its deadline', async () => {
  (fetch as jest.Mock).mockResolvedValue(
    response(200, { success: true, data: { value: 1 } }),
  );
  await expect(get('/test')).resolves.toEqual({ value: 1 });
  expect(jest.getTimerCount()).toBe(0);
});
test('timeout aborts the request and leaves credentials intact', async () => {
  let signal: AbortSignal;
  (fetch as jest.Mock).mockImplementation((_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  });
  const request = get('/slow').then(
    () => null,
    error => error,
  );
  await Promise.resolve();
  await Promise.resolve();
  await jest.runAllTimersAsync();
  const error = await request;
  expect(error).toMatchObject({
    status: 0,
    isNetworkError: true,
  });
  expect(signal!.aborted).toBe(true);
  expect(clearTokens).not.toHaveBeenCalled();
});
test('concurrent unauthorized requests share refresh and preserve rotated tokens', async () => {
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(
      response(200, { data: { access: 'new', refresh: 'rotated' } }),
    )
    .mockResolvedValue(response(200, { success: true, data: 'ok' }));
  await expect(Promise.all([get('/one'), get('/two')])).resolves.toEqual([
    'ok',
    'ok',
  ]);
  expect(saveTokens).toHaveBeenCalledWith('new', 'rotated');
  expect(
    (fetch as jest.Mock).mock.calls.filter(([url]) =>
      url.includes('/token/refresh/'),
    ),
  ).toHaveLength(1);
});
test('refresh outage does not log the user out and subsequent requests can recover', async () => {
  const onLogout = jest.fn();
  registerUnauthenticatedHandler(onLogout);
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(401, {}))
    .mockRejectedValueOnce(new Error('offline'));
  await expect(get('/one')).rejects.toThrow('offline');
  expect(clearTokens).not.toHaveBeenCalled();
  expect(onLogout).not.toHaveBeenCalled();
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(200, { access: 'recovered' }))
    .mockResolvedValueOnce(response(200, 'ok'));
  await expect(get('/one')).resolves.toBe('ok');
});
test('an explicitly rejected refresh ends the session', async () => {
  const onLogout = jest.fn();
  registerUnauthenticatedHandler(onLogout);
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(401, {}))
    .mockResolvedValueOnce(response(401, {}));
  await expect(get('/one')).rejects.toMatchObject({ isAuthError: true });
  expect(clearTokens).toHaveBeenCalledTimes(1);
  expect(onLogout).toHaveBeenCalledTimes(1);
});
test('success=false is never returned as a successful mutation result', async () => {
  (fetch as jest.Mock).mockResolvedValue(
    response(200, { success: false, message: 'Rejected', data: null }),
  );
  await expect(get('/one')).rejects.toThrow('Rejected');
});
test('a rejected refresh from an old account cannot clear a new login', async () => {
  const onLogout = jest.fn();
  registerUnauthenticatedHandler(onLogout);
  (fetch as jest.Mock)
    .mockResolvedValueOnce(response(401, {}))
    .mockImplementationOnce(async () => {
      (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'new-account', refreshToken: 'new-refresh' });
      return response(401, {});
    });
  await expect(get('/one')).rejects.toThrow('Session changed');
  expect(clearTokens).not.toHaveBeenCalled();
  expect(onLogout).not.toHaveBeenCalled();
});

test('timed-out mutations are not replayed without an idempotency contract', async () => {
  const { post } = require('../src/api/apiClient');
  (fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));
  const pending = post('/interests/', { receiver_id: 'member' }).catch((error: Error) => error);
  await jest.runAllTimersAsync();
  expect(await pending).toMatchObject({ isNetworkError: true });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test.each(['https://untrusted.example/api/v1/profiles/', 'http://mydearpartner.in/api/v1/profiles/', 'https://mydearpartner.in/private/'])('rejects unsafe API URL %s before sending credentials', async url => {
  await expect(get(url)).rejects.toThrow('Invalid API endpoint');
  expect(fetch).not.toHaveBeenCalled();
});

test('server failures do not expose backend exception details', async () => {
  (fetch as jest.Mock).mockResolvedValue(response(500, { detail: 'DatabaseError: secret internal path' }));
  await expect(get('/profiles/')).rejects.toThrow('The service is temporarily unavailable');
});


test.each([200, 401])('a delayed %s from an old account cannot refresh or expose data to a new session', async status => {
  (fetch as jest.Mock).mockImplementationOnce(async () => {
    (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'account-b', refreshToken: 'refresh-b' });
    return response(status, { private: 'account-a-data' });
  });
  await expect(get('/profiles/')).rejects.toThrow('Session changed');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(saveTokens).not.toHaveBeenCalled();
  expect(clearTokens).not.toHaveBeenCalled();
});


test('a soft-error envelope does not expose a stack trace', async () => {
  (fetch as jest.Mock).mockResolvedValue(response(200, { success: false, message: 'TypeError: private server path' }));
  await expect(get('/profiles/')).rejects.toThrow('The request could not be completed');
});

test.each([
  { code: 'match_removed', message: 'Connection ended.' },
  { data: { code: 'match_removed' }, message: 'Connection ended.' },
])('preserves structured permission codes independently of message wording', async body => {
  (fetch as jest.Mock).mockResolvedValue(response(403, body));
  await expect(get('/conversations/partner/messages/')).rejects.toMatchObject({ status: 403, code: 'match_removed' });
  expect(clearTokens).not.toHaveBeenCalled();
});

test('explicit replacement revokes the captured session without refreshing it', async () => {
  const { clearTokensForSession } = require('../src/utils/keychain');
  clearTokensForSession.mockResolvedValue(true);
  (loadTokens as jest.Mock).mockResolvedValueOnce({ accessToken: 'old', refreshToken: 'refresh' })
    .mockResolvedValueOnce({ accessToken: 'old', refreshToken: 'refresh' })
    .mockResolvedValue(null);
  const onLogout = jest.fn();
  const stop = registerUnauthenticatedHandler(onLogout);
  (fetch as jest.Mock).mockResolvedValue(response(401, { code: 'session_replaced', detail: 'Signed out.' }));
  await expect(get('/test')).rejects.toMatchObject({ code: 'session_replaced' });
  expect(clearTokensForSession).toHaveBeenCalledWith({ accessToken: 'old', refreshToken: 'refresh' });
  expect(onLogout).toHaveBeenCalledWith('session_replaced');
  expect(fetch).toHaveBeenCalledTimes(1);
  stop();
});

test('replacement cannot clear a session written by a newer login', async () => {
  const { clearTokensForSession } = require('../src/utils/keychain');
  clearTokensForSession.mockResolvedValue(false);
  const onLogout = jest.fn();
  const stop = registerUnauthenticatedHandler(onLogout);
  (fetch as jest.Mock).mockResolvedValue(response(401, { code: 'session_replaced' }));
  await expect(get('/test')).rejects.toMatchObject({ code: 'session_replaced' });
  expect(onLogout).not.toHaveBeenCalled();
  expect(saveTokens).not.toHaveBeenCalled();
  stop();
});
