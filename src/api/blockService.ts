import { Profile } from '../types/models';
import { del,get,post } from './apiClient';

export const blockService = {
  getBlockedUsers: async (): Promise<Profile[]> => {
    try {
      return await get<Profile[]>('/blocks/');
    } catch (err: any) {
      if (err?.status === 404) {
        return [];
      }
      throw err;
    }
  },

  blockUser: async (profileId: string): Promise<void> => {
    await post('/blocks/', { profile_id: profileId });
  },

  unblockUser: async (profileId: string): Promise<void> => {
    await del(`/blocks/${encodeURIComponent(profileId)}/`);
  },

  /**
   * Check if the given profile has blocked the current user.
   * Returns false gracefully if the endpoint is not yet available (404/403).
   */
  checkIfBlockedBy: async (profileId: string): Promise<boolean> => {
    try {
      const res = await get<{ blocked: boolean }>(
        `/blocks/check/?profile_id=${profileId}`,
      );
      return res?.blocked === true;
    } catch {
      // Endpoint not available — graceful fallback
      return false;
    }
  },
};
