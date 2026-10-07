/**
 * MyDearPartner — Crypto shim for React Native
 *
 * React Native does NOT ship window.crypto.subtle (WebCrypto). This shim wires the
 * WebCrypto-compatible native module (react-native-quick-crypto) onto global.crypto
 * so the app can use the EXACT same AES-GCM / PBKDF2 algorithms as the web client
 * (frontend/legacy/utils/crypto.ts). Imported FIRST at app startup in index.js.
 *
 * After installing, we run a real self-test (derive a key with the same params the
 * app uses and encrypt+decrypt in a round-trip). The result is logged so it is
 * possible to tell immediately whether the native crypto is actually functional:
 *   [shim] e2ee self-test: PASS — WebCrypto works.
 *   [shim] e2ee self-test: FAIL — <reason>. Follow the pod install / gradle steps.
 */
import 'react-native-get-random-values';
import QuickCrypto,{ install } from 'react-native-quick-crypto';

const g = globalThis as any;
const FALLBACK_SALT = 'mdp_fallback_e2ee_salt_2026';

function utf8Encode(str: string): Uint8Array {
  if (typeof g.TextEncoder === 'function') {
    try {
      return new g.TextEncoder().encode(str);
    } catch {
      /* fall through */
    }
  }
  if (typeof g.Buffer?.from === 'function') {
    const b = g.Buffer.from(str, 'utf8');
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
  return out;
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof g.TextDecoder === 'function') {
    try {
      return new g.TextDecoder('utf-8').decode(bytes);
    } catch {
      /* fall through */
    }
  }
  if (typeof g.Buffer?.from === 'function') {
    return g.Buffer.from(bytes).toString('utf8');
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

/** Real round-trip using the app's exact key derivation + AES-GCM params. */
async function runSelfTest(): Promise<void> {
  try {
    const subtle = g.crypto?.subtle;
    const hasCore =
      subtle &&
      typeof subtle.importKey === 'function' &&
      typeof subtle.deriveKey === 'function' &&
      typeof subtle.encrypt === 'function' &&
      typeof subtle.decrypt === 'function' &&
      typeof g.crypto?.getRandomValues === 'function';

    if (!hasCore) {
      g.__e2eeSelfTest = {
        ok: false,
        reason: 'crypto.subtle incomplete — native module not linked',
      };
      return;
    }

    const seed = 'mdp-selftest-seed';
    const baseKey = await g.crypto.subtle.importKey(
      'raw',
      utf8Encode(seed),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const aesKey = await g.crypto.subtle.deriveKey(
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
    const iv = g.crypto.getRandomValues(new Uint8Array(12));
    const ct = await g.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      utf8Encode('selftest'),
    );
    const pt = await g.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new Uint8Array(ct),
    );
    const ok = utf8Decode(new Uint8Array(pt)) === 'selftest';
    g.__e2eeSelfTest = {
      ok,
      reason: ok ? 'round-trip OK' : 'round-trip produced wrong plaintext',
      platform: g.Platform?.OS ?? 'n/a',
      textEncoder: typeof g.TextEncoder === 'function',
      textDecoder: typeof g.TextDecoder === 'function',
      buffer: typeof g.Buffer?.from === 'function',
    };
  } catch (e) {
    g.__e2eeSelfTest = {
      ok: false,
      reason: String((e as any)?.message ?? e),
    };
  }
}

try {
  // Always install if crypto.subtle is missing OR doesn't actually work yet.
  if (
    typeof g.crypto?.subtle?.decrypt !== 'function' ||
    typeof g.crypto?.subtle?.importKey !== 'function'
  ) {
    if (typeof install === 'function') {
      install();
    } else {
      console.warn(
        '[shim] quick-crypto has no install(); assigning object directly.',
      );
      g.crypto = QuickCrypto;
    }
  }

  // Belt-and-suspenders: make sure crypto.subtle / getRandomValues are ALWAYS set.
  if (typeof g.crypto === 'undefined' || g.crypto === null) {
    g.crypto = QuickCrypto;
  }
  if (typeof g.crypto.subtle === 'undefined') {
    g.crypto.subtle = QuickCrypto.subtle;
  }
  if (typeof g.crypto.getRandomValues === 'undefined') {
    g.crypto.getRandomValues = QuickCrypto.getRandomValues;
  }

  const ok =
    typeof g.crypto?.subtle?.decrypt === 'function' &&
    typeof g.crypto?.subtle?.importKey === 'function' &&
    typeof g.crypto?.subtle?.deriveKey === 'function' &&
    typeof g.crypto?.getRandomValues === 'function';
  
  if (!ok) {
    console.warn(
      '[shim] crypto.subtle is NOT fully available — E2EE messages will show "Encrypted".',
    );
    console.warn(
      '[shim] FIX: this is usually because the native modules are not linked. Do a FULL native rebuild:',
    );
    console.warn(
      '[shim]   iOS:    cd ios && pod install && cd .. && npx react-native run-ios',
    );
    console.warn(
      '[shim]   Android: npx react-native run-android (after clean build)',
    );
    g.__e2eeCryptoBroken = true;
  }
} catch (e) {
  console.warn('[shim] failed to install crypto:', e);
  g.__e2eeCryptoBroken = true;
}

// Async self-test — reveals whether the native crypto actually works at runtime.
runSelfTest().then(() => {
  const st = g.__e2eeSelfTest;
  if (!st) return;
  
  if (st.ok) {
    
    g.__e2eeCryptoBroken = false;
  } else {
    console.warn(
      '[shim] WebCrypto is NOT functional — E2EE messages cannot decrypt.',
    );
    console.warn('[shim] Details:', JSON.stringify(st));
    g.__e2eeCryptoBroken = true;
  }
});
