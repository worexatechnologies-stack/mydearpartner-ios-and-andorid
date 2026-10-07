/**
 * MyDearPartner — Interest Service
 *
 * Connects to Django interest & shortlist endpoints.
 * Backend: https://mydearpartner.in/api/v1/
 */

import { Interest,Profile } from '../types/models';
import { del,get,patch,post } from './apiClient';
import { mapProfile } from './profileService';
import { BackendInterest,PaginatedResponse } from './types';

function mapInterest(bi: any): Interest {
  if (!bi || typeof bi !== 'object' || !bi.id) {
    throw new Error('Could not load the request. Please try again.');
  }
  const rawDate =
    bi.created_at ||
    bi.created_on ||
    bi.created ||
    bi.date_created ||
    bi.timestamp;
  return {
    id: String(bi.id),
    fromUserId: bi.sender?.id || bi.from_user_id,
    toUserId: bi.receiver?.id || bi.to_user_id,
    status: (bi.status
      ? String(bi.status).toLowerCase()
      : 'pending') as Interest['status'],
    createdAt: rawDate ? new Date(rawDate).getTime() : Date.now(),
    senderProfile: bi.sender ? mapProfile(bi.sender) : undefined,
    receiverProfile: bi.receiver ? mapProfile(bi.receiver) : undefined,
  };
}

/** Extract results from paginated or plain array response */
function extractResults<T>(data: PaginatedResponse<T> | T[]): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as any).results))
    return (data as any).results;
  if (data && typeof data === 'object' && Array.isArray((data as any).data))
    return (data as any).data;
  return [];
}

/**
 * Get interests received by the current user.
 * Django backend requires `?type=incoming`.
 */
export async function getReceivedInterests(): Promise<Interest[]> {
  const data = await get<any>('/interests/?type=incoming');
  return extractResults(data).filter((item: any) => item && typeof item === 'object' && item.id).map(mapInterest);
}

/**
 * Get interests sent by the current user.
 * Django backend requires `?type=outgoing`.
 */
export async function getSentInterests(): Promise<Interest[]> {
  const data = await get<any>('/interests/?type=outgoing');
  return extractResults(data).filter((item: any) => item && typeof item === 'object' && item.id).map(mapInterest);
}

async function trySend(payload: any): Promise<Interest> {
  

  try {
    const data = await post<any>('/interests/', payload);

    

    // If the backend returns a soft error (200 OK but contains an error detail instead of an ID)
    if (
      data &&
      !data.id &&
      (data.detail || data.receiver || data.error || data.message)
    ) {
      const rawMsg =
        data.detail ||
        data.message ||
        data.error ||
        (Array.isArray(data.receiver)
          ? data.receiver[0]
          : typeof data.receiver === 'string'
          ? data.receiver
          : null) ||
        'Request could not be sent.';
      const err = new Error(
        typeof rawMsg === 'string' ? rawMsg : JSON.stringify(rawMsg),
      );
      (err as any).status = 400;
      (err as any).data = data;
      throw err;
    }
    if (!data || !data.id) {
      throw new Error('Invalid response from server when sending interest.');
    }

    return mapInterest(data);
  } catch (err: any) {
    
    throw err;
  }
}

/**
 * Send an interest to another profile.
 */
export async function sendInterest(
  toProfileId: string,
  toUserId?: string,
): Promise<Interest> {
  try {
    return await trySend({ receiver_id: toUserId || toProfileId });
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();

    // If the server says "not eligible or available" or "already", an interest is already present on the server
    if (
      msg.includes('eligible') ||
      msg.includes('available') ||
      msg.includes('already') ||
      msg.includes('exists')
    ) {
      
      try {
        const sentList = await getSentInterests();
        const existingInterest = sentList.find(
          i =>
            String(i.toUserId) === String(toProfileId) ||
            String(i.receiverProfile?.id) === String(toProfileId) ||
            (toUserId && String(i.toUserId) === String(toUserId)),
        );
        if (existingInterest) {
          
          return existingInterest;
        }

        const receivedList = await getReceivedInterests();
        const incoming = receivedList.find(
          i =>
            String(i.fromUserId) === String(toProfileId) ||
            String(i.senderProfile?.id) === String(toProfileId) ||
            (toUserId && String(i.fromUserId) === String(toUserId)),
        );
        if (incoming) {
          
          return await respondToInterest(incoming.id, 'accepted');
        }
      } catch (e) {
        console.warn(
          '[interestService] Failed to fetch sent/received interests for fallback.',
          e,
        );
      }
      throw new Error(
        'Interest already exists, but unable to retrieve actual record from server.',
      );
    }

    if ([400, 422].includes(err?.status) && toUserId && toUserId !== toProfileId) {
      try {
        return await trySend({ receiver_id: toProfileId });
      } catch (err2: any) {
        const msg2 = (err2?.message || '').toLowerCase();
        if (
          msg2.includes('eligible') ||
          msg2.includes('available') ||
          msg2.includes('already') ||
          msg2.includes('exists')
        ) {
          
          try {
            const sentList = await getSentInterests();
            const existingInterest = sentList.find(
              i =>
                String(i.toUserId) === String(toProfileId) ||
                String(i.receiverProfile?.id) === String(toProfileId) ||
                String(i.toUserId) === String(toUserId),
            );
            if (existingInterest) {
              return existingInterest;
            }

            const receivedList = await getReceivedInterests();
            const incoming = receivedList.find(
              i =>
                String(i.fromUserId) === String(toProfileId) ||
                String(i.senderProfile?.id) === String(toProfileId) ||
                String(i.fromUserId) === String(toUserId),
            );
            if (incoming) {
              return await respondToInterest(incoming.id, 'accepted');
            }
          } catch (e) {
            console.warn(
              '[interestService] Failed to fetch sent/received interests for fallback.',
              e,
            );
          }
          throw new Error(
            'Interest already exists, but unable to retrieve actual record from server.',
          );
        }
      }
    }

    throw err;
  }
}

/**
 * Cancel (delete) a sent interest.
 */
export async function cancelInterest(interestId: string): Promise<void> {
  if (!interestId) {
    return;
  }

  

  try {
    await del(`/interests/${interestId}/`);
    
  } catch (err: any) {
    
    const msg = (err?.message || '').toLowerCase();
    if (
      err?.status === 404 ||
      msg.includes('not found') ||
      msg.includes('404') ||
      msg.includes('already') ||
      msg.includes('no longer')
    ) {
      return; // Already deleted or cancelled on server
    }
    if (![404, 405].includes(err?.status)) throw err;
    try {
      await patch(`/interests/${interestId}/`, { status: 'DECLINED' });
    } catch (patchError: any) {
      if (![404, 405].includes(patchError?.status)) throw patchError;
      try {
        await post(`/interests/${interestId}/withdraw/`, {});
      } catch (withdrawError: any) {
        if (![404, 405].includes(withdrawError?.status)) throw withdrawError;
        try {
          await post(`/interests/${interestId}/cancel/`, {});
        } catch {
          console.error(
            '[interestService] cancelInterest completely failed for all fallbacks:',
            err?.message,
          );
          throw err;
        }
      }
    }
  }
}

/**
 * Respond to a received interest (accept or decline).
 */
export async function respondToInterest(
  interestId: string,
  status: 'accepted' | 'declined',
): Promise<Interest> {
  const data = await patch<BackendInterest>(`/interests/${interestId}/`, {
    status: status.toUpperCase() as any,
  });
  return mapInterest(data);
}

/**
 * Get all shortlisted profiles from the server.
 */
export async function getShortlists(): Promise<Profile[]> {
  const data = await get<any>('/shortlists/');
  const items = extractResults(data);
  return items
    .filter((item: any) => item && item.id) // skip malformed/incomplete items
    .map((item: any) => mapProfile(item));
}

/**
 * Toggle shortlist status for a profile on the server.
 * Returns { action: 'added' | 'removed', shortlisted: boolean }
 */
export async function toggleShortlistApi(
  profileId: string,
): Promise<{ action: 'added' | 'removed'; shortlisted: boolean }> {
  return post<any>('/shortlists/', { profile_id: profileId });
}

/** Remove an accepted match sent by this member; failures must remain visible. */
export async function removeConnection(interestId: string): Promise<void> {
  if (!interestId) throw new Error('Missing connection identifier.');
  await del(`/interests/${interestId}/`);
}
