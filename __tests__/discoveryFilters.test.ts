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

describe('unconnected profile visibility', () => {
  const { hasActiveDiscoveryRelationship, activeDiscoveryMemberIds } = require('../src/utils/discoveryFilters');
  test.each(['none', 'declined', 'withdrawn', 'cancelled', 'removed'])('%s relationships remain discoverable', status => {
    expect(hasActiveDiscoveryRelationship(status)).toBe(false);
  });
  test.each(['pending', 'sent', 'received', 'accepted'])('%s relationships remain excluded', status => {
    expect(hasActiveDiscoveryRelationship(status)).toBe(true);
  });
  test('only active partners are excluded across member/profile aliases and both directions', () => {
    const interests = [
      { id: 'removed', status: 'declined', fromUserId: 'me', toUserId: 'removed-member', receiverProfile: { id: 'removed-profile' } },
      { id: 'withdrawn', status: 'withdrawn', fromUserId: 'old-member', toUserId: 'me' },
      { id: 'sent', status: 'pending', fromUserId: 'me', toUserId: 'pending-member', receiverProfile: { id: 'pending-profile', userId: 'pending-member' } },
      { id: 'received', status: 'accepted', fromUserId: 'connected-member', toUserId: 'me', senderProfile: { id: 'connected-profile' } },
    ];
    expect([...activeDiscoveryMemberIds(interests, ['me', 'my-profile'])].sort()).toEqual([
      'connected-member', 'connected-profile', 'pending-member', 'pending-profile',
    ]);
    expect([...activeDiscoveryMemberIds(interests.map(item => ({ ...item, status: 'withdrawn' })), ['me'])]).toEqual([]);
  });
});
