/**
 * A process-safe readiness gate for the cryptography used by message delivery.
 *
 * New messages use server-managed encrypted storage; legacy history decoding
 * requires no private device key. The member ID and authenticated
 * session are nevertheless required and must be restored before a background
 * task attempts a decrypt.
 */
import { getMemberUserIdFromToken } from '../utils/jwt';
import { getUserIds,loadTokens } from '../utils/keychain';

export type MessagingCryptoState =
  | 'NOT_INITIALIZED'
  | 'INITIALIZING'
  | 'READY'
  | 'FAILED'
  | 'LOGGED_OUT';

let state: MessagingCryptoState = 'NOT_INITIALIZED';
let readyPromise: Promise<string | null> | null = null;
let memberId: string | null = null;
let generation = 0;

export function getMessagingCryptoState(): MessagingCryptoState {
  return state;
}

export function getReadyMemberId(): string | null {
  return state === 'READY' ? memberId : null;
}

/** Restore the session/identity exactly once; concurrent push handlers share it. */
export async function waitForMessagingCryptoReady(): Promise<string | null> {
  if (state === 'READY' && memberId) return memberId;
  if (state === 'LOGGED_OUT') return null;
  if (readyPromise) return readyPromise;

  const revision = generation;
  state = 'INITIALIZING';
  readyPromise = (async () => {
    try {
      const [tokens, identity] = await Promise.all([
        loadTokens(),
        getUserIds(),
      ]);
      if (revision !== generation) return null;
      if (!tokens?.accessToken) {
        state = 'LOGGED_OUT';
        memberId = null;
        return null;
      }

      // The JWT is authoritative. The securely persisted value lets us recover
      // if a token implementation omits the legacy account-id claim.
      memberId =
        getMemberUserIdFromToken(tokens.accessToken) ??
        identity?.memberId ??
        null;
      state = memberId ? 'READY' : 'FAILED';
      return memberId;
    } catch {
      if (revision !== generation) return null;
      memberId = null;
      state = 'FAILED';
      return null;
    } finally {
      if (revision === generation) readyPromise = null;
    }
  })();
  return readyPromise;
}

/** Call after login/session restoration, once the identity has been persisted. */
export async function initializeMessagingCrypto(): Promise<string | null> {
  if (state === 'FAILED' || state === 'LOGGED_OUT') state = 'NOT_INITIALIZED';
  return waitForMessagingCryptoReady();
}

export function markMessagingCryptoLoggedOut(): void {
  generation += 1;
  memberId = null;
  readyPromise = null;
  state = 'LOGGED_OUT';
}
