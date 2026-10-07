import { Profile } from '../types/models';

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
