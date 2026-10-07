import { upload } from '../src/api/apiClient';
import { loadTokens, saveTokens } from '../src/utils/keychain';
jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn(), saveTokens: jest.fn(), clearTokens: jest.fn() }));

test('expired upload refreshes credentials and retries the same multipart body once', async () => {
  const originalXHR = global.XMLHttpRequest;
  const originalFetch = global.fetch;
  const headers: string[] = [];
  const bodies: unknown[] = [];
  let attempts = 0;
  (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'old', refreshToken: 'refresh' });
  (saveTokens as jest.Mock).mockImplementation(async () => {
    (loadTokens as jest.Mock).mockResolvedValue({ accessToken: 'new', refreshToken: 'refresh' });
  });
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ access: 'new' }) });
  global.XMLHttpRequest = jest.fn(() => {
    const xhr: any = { open: jest.fn(), setRequestHeader: (key: string, value: string) => { if (key === 'Authorization') headers.push(value); } };
    xhr.send = (body: unknown) => {
      bodies.push(body);
      xhr.status = ++attempts === 1 ? 401 : 200;
      xhr.responseText = JSON.stringify({ photo_url: '/photo' });
      xhr.onload();
    };
    return xhr;
  }) as any;
  try {
    const body = new FormData();
    await expect(upload('/upload', body)).resolves.toEqual({ photo_url: '/photo' });
    expect(headers).toEqual(['Bearer old', 'Bearer new']);
    expect(bodies).toEqual([body, body]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally {
    global.XMLHttpRequest = originalXHR;
    global.fetch = originalFetch;
  }
});
