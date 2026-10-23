/**
 * MyDearPartner — Shortlist / Favourites Service
 *
 * Lets users bookmark profiles they want to revisit later.
 * Backend: POST/DELETE /api/v1/shortlist/{profileId}/
 *          GET /api/v1/shortlist/
 */

import { del, get, post } from './apiClient';
import { BackendProfile } from './types';

export interface ShortlistEntry {
  id: string;
  profileId: string;
  createdAt: string;
  profile?: BackendProfile;
}

/**
 * Fetch all shortlisted profiles for the current user.
 */
export async function getShortlist(): Promise<ShortlistEntry[]> {
  try {
    const response = await get<any>('/shortlists/');
    const items: any[] = Array.isArray(response)
      ? response
      : Array.isArray(response?.results)
      ? response.results
      : Array.isArray(response?.data)
      ? response.data
      : [];
    return items.map(normalizeEntry);
  } catch {
    return [];
  }
}

/**
 * Add a profile to the shortlist.
 */
export async function addToShortlist(profileId: string): Promise<ShortlistEntry> {
  try {
    const response = await post<any>('/shortlists/', { profile_id: profileId });
    return normalizeEntry(response);
  } catch {
    try {
      const fallback = await post<any>(`/shortlist/${profileId}/`, {});
      return normalizeEntry(fallback);
    } catch {
      return {
        id: `local_${profileId}`,
        profileId,
        createdAt: new Date().toISOString(),
      };
    }
  }
}

/**
 * Remove a profile from the shortlist.
 */
export async function removeFromShortlist(profileId: string): Promise<void> {
  try {
    await post<any>('/shortlists/', { profile_id: profileId });
  } catch {
    try {
      await del(`/shortlist/${profileId}/`);
    } catch {
      // ignore
    }
  }
}

/**
 * Check if a specific profile is shortlisted.
 */
export async function isShortlisted(profileId: string): Promise<boolean> {
  try {
    const list = await getShortlist();
    return list.some(entry => entry.profileId === profileId);
  } catch {
    return false;
  }
}

function normalizeEntry(raw: any): ShortlistEntry {
  return {
    id: raw?.id ?? raw?.shortlist_id ?? '',
    profileId: raw?.profile_id ?? raw?.member_id ?? raw?.profileId ?? '',
    createdAt: raw?.created_at ?? raw?.createdAt ?? new Date().toISOString(),
    profile: raw?.profile ?? raw?.member_profile ?? undefined,
  };
}
