import { encryptMessageForChat, smartDecryptText } from '../src/utils/crypto';
import { get } from '../src/api/apiClient';
import { webcrypto } from 'crypto';

jest.mock('../src/api/apiClient', () => ({ get: jest.fn() }));
jest.mock('react-native-quick-crypto', () => require('crypto'));
jest.mock('react-native-base64', () => ({
  __esModule: true,
  default: {
    encodeFromByteArray: (bytes: number[]) => Buffer.from(bytes).toString('base64'),
    decode: (value: string) => Buffer.from(value, 'base64').toString('binary'),
  },
}));

const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
beforeAll(() => Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto }));
afterAll(() => {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else delete (globalThis as any).crypto;
});

beforeEach(() => jest.clearAllMocks());

test('app uses the GitHub web wire protocol without a security endpoint request', async () => {
  (get as jest.Mock).mockRejectedValue({ status: 404 });
  const wire = await encryptMessageForChat('Hello 👋 नमस्ते', 'sender', 'receiver');
  expect(wire.startsWith('__E2EE__:')).toBe(true);
  expect(wire).not.toContain('Hello');
  await expect(smartDecryptText(wire, 'receiver', 'sender')).resolves.toBe('Hello 👋 नमस्ते');
  expect(get).not.toHaveBeenCalled();
});

test('encryption errors reject sending instead of returning plaintext', async () => {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  try {
    await expect(encryptMessageForChat('private text', 'sender', 'receiver')).rejects.toThrow();
  } finally {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
  }
});

test('invalid conversations cannot prepare a message', async () => {
  await expect(encryptMessageForChat('private text', 'sender', 'sender')).rejects.toThrow('valid conversation');
  expect(get).not.toHaveBeenCalled();
});
