/**
 * MyDearPartner — JWT helpers
 *
 * The access token (JWT) carries the member/account user id (the same id the
 * web client uses as its half of the E2EE key seed). The profile id and the
 * member id are DIFFERENT in this backend, so we must use the member id for
 * crypto — that is what makes web <-> mobile messages decrypt.
 */

import { Buffer } from 'react-native-quick-crypto';

/** Decode the payload segment of a JWT (RN has no atob/btoa). */
export function decodeJwtPayload(
  token: string,
): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url -> base64
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('[jwt] decodeJwtPayload failed:', e);
    return null;
  }
}

/**
 * Extract the member/account user id from a JWT.
 * SimpleJWT on this backend issues the claim as `account_id` (we verified it
 * on the live server).  Other deployments may use user_id / sub / id.
 */
export function getMemberUserIdFromToken(token: string): string | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  for (const key of [
    'account_id',
    'accountId',
    'user_id',
    'userId',
    'sub',
    'id',
    'member_id',
  ]) {
    const v = payload[key];
    if (v !== undefined && v !== null) return String(v);
  }
  return null;
}
