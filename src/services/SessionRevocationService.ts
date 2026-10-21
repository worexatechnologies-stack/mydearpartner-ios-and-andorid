import { get } from '../api/apiClient';
import { loadTokens } from '../utils/keychain';
import { decodeJwtPayload } from '../utils/jwt';

/** Push is a hint, never authority to clear credentials. Ignore stale session IDs. */
export async function verifySessionRevocation(data: Record<string, unknown>): Promise<boolean> {
  const stored = await loadTokens();
  if (!stored?.accessToken || typeof data.session_id !== 'string') return false;
  const sid = decodeJwtPayload(stored.accessToken)?.mdp_sid;
  if (!sid || sid !== data.session_id) return false;
  try {
    await get('/auth/session/');
  } catch (error) {
    return (error as { code?: string })?.code === 'session_replaced';
  }
  return false;
}
