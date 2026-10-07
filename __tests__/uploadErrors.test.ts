import { upload } from '../src/api/apiClient';
jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn().mockResolvedValue(null) }));
test('an upload failure inside a 200 envelope remains a failure', async () => {
  const original = global.XMLHttpRequest;
  const xhr: any = { open: jest.fn(), setRequestHeader: jest.fn(), status: 200, responseText: JSON.stringify({ success: false, message: 'Rejected', data: null }) };
  xhr.send = () => xhr.onload();
  global.XMLHttpRequest = jest.fn(() => xhr) as any;
  try { await expect(upload('/upload', new FormData())).rejects.toThrow('Rejected'); }
  finally { global.XMLHttpRequest = original; }
});


test('server-side upload failures do not expose internal exception details', async () => {
  const original = global.XMLHttpRequest;
  const xhr: any = { open: jest.fn(), setRequestHeader: jest.fn(), status: 500, responseText: JSON.stringify({ detail: 'DatabaseError: private server path' }) };
  xhr.send = () => xhr.onload();
  global.XMLHttpRequest = jest.fn(() => xhr) as any;
  try { await expect(upload('/upload', new FormData())).rejects.toThrow('The service is temporarily unavailable'); }
  finally { global.XMLHttpRequest = original; }
});
