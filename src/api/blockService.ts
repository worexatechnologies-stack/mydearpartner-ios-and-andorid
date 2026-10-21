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
   * Returns null when the status cannot be confirmed; unknown never means unblocked.
   */
  checkIfBlockedBy: async (profileId: string): Promise<boolean | null> => {
    try {
      const res = await get<{ blocked: boolean }>(
        `/blocks/check/?profile_id=${encodeURIComponent(profileId)}`,
      );
      return typeof res?.blocked === 'boolean' ? res.blocked : null;
    } catch {
      return null;
    }
  },
};
