/**
 * MyDearPartner — legacy ciphertext compatibility
 *
 * Public-ID derivation below is retained only to read historical messages.
 * Uses the protocol in GitHub main's web client for app/web compatibility.
 * Public-ID key derivation is a legacy confidentiality limitation.
 *
 *  - Key: AES-GCM-256 derived via PBKDF2 (SHA-256, 1000 iters, fixed salt)
 *    from the deterministic seed  [userA, userB].sort().join('_')
 *  - IV: 12 random bytes
 *  - Wire format:  __E2EE__:{"iv":"<b64>","ct":"<b64>"}
 *
 * Legacy decoding parameters must remain stable for history compatibility.
 */

import base64 from 'react-native-base64';
import {
Buffer as QCBuffer,
createCipheriv,
createDecipheriv,
pbkdf2Sync,
} from 'react-native-quick-crypto';

const E2EE_PREFIX = '__E2EE__:';
const FALLBACK_SALT = 'mdp_fallback_e2ee_salt_2026';
const GCM_TAG_LENGTH = 16; // bytes WebCrypto appends to the ciphertext

/** Returned by smartDecryptText when no seed can decrypt the ciphertext. */
export const E2EE_DECRYPT_FAILED = '🔒 Encrypted message';

// Must match the web client (frontend/legacy/utils/crypto.ts): normalise seeds
// to lower-case + trim so key derivation is byte-identical across web <-> mobile
// regardless of UUID casing.
function normalizeSeed(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

// RN has no atob/btoa — use react-native-base64 (bytes <-> base64).
function bytesToBase64(bytes: Uint8Array): string {
  return base64.encodeFromByteArray(Array.from(bytes));
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = base64.decode(b64); // binary string of bytes
  const buf = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) {
    buf[i] = bin.charCodeAt(i);
  }
  return buf;
}

// ─── UTF-8 safe helpers (Hermes may lack TextEncoder/TextDecoder) ─────────────

function toUint8(buffer: QCBuffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    buffer.buffer as ArrayBuffer,
    buffer.byteOffset,
    buffer.byteLength,
  );
}

function utf8Encode(str: string): Uint8Array<ArrayBuffer> {
  const g = globalThis as any;
  if (typeof g.TextEncoder === 'function') {
    try {
      return new g.TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
    } catch {
      /* fall through to Buffer */
    }
  }
  if (typeof QCBuffer.from === 'function') {
    const b = QCBuffer.from(str, 'utf8');
    return toUint8(b);
  }
  // Last-resort byte-only encoder (plain ASCII still works).
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function utf8Decode(bytes: Uint8Array): string {
  const g = globalThis as any;
  if (typeof g.TextDecoder === 'function') {
    try {
      return new g.TextDecoder('utf-8').decode(bytes);
    } catch {
      /* fall through to Buffer */
    }
  }
  if (typeof QCBuffer.from === 'function') {
    return QCBuffer.from(bytes).toString('utf8');
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  try {
    return decodeURIComponent(escape(s));
  } catch {
    return s;
  }
}

// ─── Native Node-style path (independent of the subtle shim) ─────────────────

/** PBKDF2-SHA256 → 32 bytes, same params as the web client. */
function deriveKeyBytesNative(seed: string): Uint8Array {
  const keyBuf = pbkdf2Sync(seed, FALLBACK_SALT, 1000, 32, 'sha256');
  return toUint8(keyBuf);
}

/** AES-256-GCM encrypt; output matches WebCrypto: ciphertext || 16-byte tag. */
function nativeEncrypt(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  plain: Uint8Array,
): Uint8Array {
  const cipher = createCipheriv(
    'aes-256-gcm',
    QCBuffer.from(keyBytes) as any,
    QCBuffer.from(iv) as any,
  );
  const enc = QCBuffer.concat([
    cipher.update(QCBuffer.from(plain) as any),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return toUint8(QCBuffer.concat([enc, tag]));
}

/** AES-256-GCM decrypt; splits the trailing 16-byte tag like WebCrypto does. */
function nativeDecrypt(
  keyBytes: Uint8Array,
  iv: Uint8Array,
  ct: Uint8Array,
): Uint8Array | null {
  try {
    const buf = QCBuffer.from(ct);
    if (buf.length < GCM_TAG_LENGTH) return null;
    const tag = buf.subarray(buf.length - GCM_TAG_LENGTH);
    const data = buf.subarray(0, buf.length - GCM_TAG_LENGTH);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      QCBuffer.from(keyBytes) as any,
      QCBuffer.from(iv) as any,
    );
    decipher.setAuthTag(tag);
    const plain = QCBuffer.concat([
      decipher.update(data as any),
      decipher.final(),
    ]);
    return toUint8(plain);
  } catch {
    return null;
  }
}

/**
 * Guards that WebCrypto is actually available. On RN this requires the
 * react-native-quick-crypto shim to have run at startup (src/utils/shim.ts).
 */
function ensureWebCrypto(): void {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle || typeof subtle.deriveKey !== 'function') {
    throw new Error(
      'WebCrypto (crypto.subtle) is not available. Make sure src/utils/shim.ts ' +
        'is the first import and react-native-quick-crypto is installed.',
    );
  }
}

/**
 * Deterministic PBKDF2 fallback key for a conversation pair.
 * seed is the pair of user ids joined/sorted: `[userA, userB].sort().join('_')`.
 */
export async function deriveFallbackKey(seed: string): Promise<CryptoKey> {
  ensureWebCrypto();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    utf8Encode(seed),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: utf8Encode(FALLBACK_SALT),
      iterations: 1000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** Derive the active key for a given (myId, partnerId) conversation. */
export async function deriveConversationKey(
  myId: string,
  partnerId: string,
): Promise<CryptoKey> {
  return deriveFallbackKey(conversationSeed(myId, partnerId));
}

/** The deterministic seed string used for a conversation pair. */
export function conversationSeed(myId: string, partnerId: string): string {
  return [normalizeSeed(myId), normalizeSeed(partnerId)].sort().join('_');
}

function wire(iv: Uint8Array, ct: Uint8Array): string {
  return `${E2EE_PREFIX}${JSON.stringify({
    iv: bytesToBase64(iv),
    ct: bytesToBase64(ct),
  })}`;
}

/**
 * Match GitHub main's web sender without requiring an absent server endpoint.
 */
export async function encryptMessageForChat(
  text: string,
  myId: string,
  partnerId: string,
): Promise<string> {
  if (!normalizeSeed(myId) || !normalizeSeed(partnerId) || normalizeSeed(myId) === normalizeSeed(partnerId)) {
    throw new Error('A valid conversation is required.');
  }
  // Encryption failure propagates; never send plaintext as a fallback.
  return encryptMessage(text, conversationSeed(myId, partnerId));
}

/** Encrypt plaintext into the web-compatible wire format. */
export async function encryptMessage(
  text: string,
  key: CryptoKey | string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  try {
    const aesKey = typeof key === 'string' ? await deriveFallbackKey(key) : key;
    const ct = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      utf8Encode(text),
    );
    return wire(iv, new Uint8Array(ct));
  } catch (e) {
    try {
      const keyBytes =
        typeof key === 'string'
          ? deriveKeyBytesNative(key)
          : new Uint8Array(await crypto.subtle.exportKey('raw', key));
      const ct = nativeEncrypt(keyBytes, iv, utf8Encode(text));
      return wire(iv, ct);
    } catch (e2) {
      console.warn('[crypto] encryptMessage failed (subtle + native).', e, e2);
      throw e;
    }
  }
}

/** Subtle-based decrypt. Returns null on any failure. */
async function decryptPayload(
  payload: { iv: string; ct: string },
  key: CryptoKey,
): Promise<string | null> {
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
      key,
      base64ToBytes(payload.ct),
    );
    return utf8Decode(new Uint8Array(plain));
  } catch {
    return null;
  }
}

/** Native (quick-crypto) decrypt for a seed. Returns null on any failure. */
function decryptPayloadNative(
  payload: { iv: string; ct: string },
  seed: string,
): string | null {
  try {
    const keyBytes = deriveKeyBytesNative(seed);
    const plain = nativeDecrypt(
      keyBytes,
      base64ToBytes(payload.iv),
      base64ToBytes(payload.ct),
    );
    return plain ? utf8Decode(plain) : null;
  } catch {
    return null;
  }
}

/**
 * Decrypt any stored message:
 *  - Non-ciphertext (legacy plaintext) is returned unchanged.
 *  - Tries a series of deterministic fallback seeds (same algorithm as web).
 *  - senderMemberId / receiverMemberId come from the message row itself and are
 *    the MEMBER/account ids on both platforms. Their sorted pair is exactly the
 *    seed the web client used, so a message decrypts even if the app-context
 *    ids (currentUserId / partnerUserId) are wrong or not available yet.
 *  - Returns E2EE_DECRYPT_FAILED only if nothing can decrypt it.
 */
export async function smartDecryptText(
  text?: string | null,
  currentUserId?: string,
  partnerUserId?: string,
  conversationId?: string,
  senderMemberId?: string,
  receiverMemberId?: string,
): Promise<string> {
  if (!text || typeof text !== 'string') return '';
  const isCipher =
    text.includes(E2EE_PREFIX) ||
    text.includes('_E2EE_') ||
    (text.includes('"iv":') && text.includes('"ct":'));
  if (!isCipher) return text;

  let raw = text;
  if (raw.includes(E2EE_PREFIX)) {
    raw = raw.slice(raw.indexOf(E2EE_PREFIX) + E2EE_PREFIX.length);
  } else if (raw.includes('_E2EE_')) {
    raw = raw.replace(/^.*?_E2EE_\s*:\s*/, '');
  }

  let payload: { iv: string; ct: string };
  try {
    payload = JSON.parse(raw.trim());
  } catch {
    return text;
  }

  // Build the sorted-pair seed the same way the web client does:
  //   [userA, userB].sort().join('_') with lower-case + trimmed members.
  const norm = (v?: string | null) => normalizeSeed(v);
  const pair = (a?: string | null, b?: string | null) =>
    [norm(a), norm(b)].filter(Boolean).sort().join('_');

  // Deterministic fallback seeds — ordered best-guess first.
  const candidates = [
    pair(currentUserId, partnerUserId),
    pair(senderMemberId, receiverMemberId),
    pair(currentUserId, senderMemberId),
    pair(currentUserId, receiverMemberId),
    pair(partnerUserId, senderMemberId),
    pair(partnerUserId, receiverMemberId),
    norm(conversationId),
    norm(partnerUserId),
    norm(senderMemberId),
    norm(receiverMemberId),
    norm(currentUserId),
    'default',
  ];

  // De-dupe while preserving order (each unique seed = one PBKDF2 derivation).
  const seen = new Set<string>();
  const seeds: string[] = [];
  for (const s of candidates) {
    if (s && !seen.has(s)) {
      seen.add(s);
      seeds.push(s);
    }
  }

  const subtle: any = (globalThis as any).crypto?.subtle;
  const hasSubtle =
    subtle &&
    typeof subtle.decrypt === 'function' &&
    typeof subtle.importKey === 'function';

  for (const seed of seeds) {
    // 1) Standard WebCrypto path (browser / working shim).
    if (hasSubtle) {
      try {
        const key = await deriveFallbackKey(seed);
        const decrypted = await decryptPayload(payload, key);
        if (decrypted) return decrypted;
      } catch {
        // try native path below
      }
    }
    // 2) Native AES-GCM path directly through quick-crypto.
    try {
      const native = decryptPayloadNative(payload, seed);
      if (native) return native;
    } catch {
      // try next seed
    }
  }

  const g = globalThis as any;
  console.warn(
    '[crypto] Could not decrypt E2EE message.',
    JSON.stringify({
      subtleReady: hasSubtle,
      selfTest: g.__e2eeSelfTest ?? null,
    }),
  );
  return E2EE_DECRYPT_FAILED;
}
