import { Interest, Profile } from '../types/models';

export interface DiscoveryFilters {
  maritalStatus: string;
  diet: string;
  verified: string;
  online: string;
}
export const defaultDiscoveryFilters: DiscoveryFilters = {
  maritalStatus: 'Any',
  diet: 'Any',
  verified: 'Any',
  online: 'Any',
};
const normalize = (value?: string) =>
  (value ?? '').toLowerCase().replace(/[\s_-]+/g, '');

export function filterDiscoveryProfiles(
  profiles: Profile[],
  filters: DiscoveryFilters,
): Profile[] {
  return profiles.filter(
    profile =>
      (filters.maritalStatus === 'Any' ||
        normalize(profile.maritalStatus) ===
          normalize(filters.maritalStatus)) &&
      (filters.diet === 'Any' ||
        normalize(profile.diet) === normalize(filters.diet)) &&
      (filters.verified === 'Any' || profile.isVerified === true) &&
      (filters.online === 'Any' || profile.isOnline === true),
  );
}

/** Only a live request or accepted match should hide a member from discovery. */
export function hasActiveDiscoveryRelationship(status: string): boolean {
  return ['pending', 'sent', 'received', 'accepted'].includes(status);
}

export function activeDiscoveryMemberIds(interests: Interest[], ownIds: string[]): Set<string> {
  const own = new Set(ownIds.filter(Boolean).map(String));
  const ids = new Set<string>();
  interests.filter(interest => hasActiveDiscoveryRelationship(interest.status)).forEach(interest => {
    [interest.fromUserId, interest.toUserId, interest.senderProfile?.id, interest.senderProfile?.userId,
      interest.receiverProfile?.id, interest.receiverProfile?.userId].forEach(id => {
      if (id && !own.has(String(id))) ids.add(String(id));
    });
  });
  return ids;
}
