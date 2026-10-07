import {
  defaultDiscoveryFilters,
  filterDiscoveryProfiles,
} from '../src/utils/discoveryFilters';
import { Profile } from '../src/types/models';
const profiles = [
  {
    id: '1',
    maritalStatus: 'Never Married',
    diet: 'Non Vegetarian',
    isOnline: true,
    isVerified: true,
  },
  {
    id: '2',
    maritalStatus: 'Divorced',
    diet: 'Vegetarian',
    isOnline: false,
    isVerified: true,
  },
  { id: '3' },
] as Profile[];

test('default filters preserve all profiles including incomplete profiles', () => {
  expect(filterDiscoveryProfiles(profiles, defaultDiscoveryFilters)).toEqual(
    profiles,
  );
});
test('combines preferences and normalizes backend spacing and separators', () => {
  expect(
    filterDiscoveryProfiles(profiles, {
      maritalStatus: 'Never Married',
      diet: 'Non-Vegetarian',
      verified: 'Verified only',
      online: 'Online now',
    }).map(p => p.id),
  ).toEqual(['1']);
});
test('does not match missing fields or confuse vegetarian and non-vegetarian', () => {
  expect(
    filterDiscoveryProfiles(profiles, {
      ...defaultDiscoveryFilters,
      diet: 'Vegetarian',
    }).map(p => p.id),
  ).toEqual(['2']);
  expect(
    filterDiscoveryProfiles(profiles, {
      ...defaultDiscoveryFilters,
      maritalStatus: 'Widowed',
    }),
  ).toEqual([]);
});
