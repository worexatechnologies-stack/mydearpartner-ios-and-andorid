import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { useAuth } from '../src/context/AuthContext';
import { useAppData } from '../src/context/AppDataContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlanAllowance, markDailyInterestsExhausted, isDailyInterestsExhaustedToday, recordInterestSentToday, getDailyInterestsSentCountToday, recordProfileViewToday, getViewedProfileIdsToday } from '../src/utils/planAllowance';
jest.mock('../src/context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../src/context/AppDataContext', () => ({ useAppData: jest.fn() }));
jest.mock('../src/api/membershipService', () => ({
  getCachedMembershipPlans: async () => [],
  fetchMembershipPlansFromBackend: async () => [],
  subscribeToPlanUpdates: () => () => {},
  resolvePlanLimits: () => ({ dailyInterests: 3, dailyProfileViews: 10, contactUnlocks: 0 }),
}));
jest.mock('@react-native-async-storage/async-storage', () => {
  const data = new Map();
  return { getItem: jest.fn(async key => data.get(key) ?? null), setItem: jest.fn(async (key, value) => { data.set(key, value); }), removeItem: jest.fn(async key => { data.delete(key); }) };
});

test('usage and exhaustion remain isolated when another account signs in', async () => {
  await markDailyInterestsExhausted(true, 'account-a');
  await recordInterestSentToday('profile', 'account-a');
  await recordProfileViewToday('profile', 'account-a');
  expect(await isDailyInterestsExhaustedToday('account-b')).toBe(false);
  expect(await getDailyInterestsSentCountToday('account-b')).toBe(0);
  expect(await getViewedProfileIdsToday('account-b')).toEqual([]);
  expect(await isDailyInterestsExhaustedToday('account-a')).toBe(true);
  expect(await getDailyInterestsSentCountToday('account-a')).toBe(1);
  expect(AsyncStorage.setItem).toHaveBeenCalled();
});
test('parallel actions do not lose usage updates', async () => {
  await Promise.all([recordInterestSentToday('one', 'parallel'), recordInterestSentToday('two', 'parallel')]);
  expect(await getDailyInterestsSentCountToday('parallel')).toBe(2);
});
test.each([0, 7])('premium allowances honor server limit %s', async limit => {
  (useAuth as jest.Mock).mockReturnValue({ currentUser: {
    id: 'premium-test', isPremium: true, planSlug: 'gold',
    profile: { activeMembership: { is_active: true, plan_slug: 'gold', entitlements: {
      daily_interest_limit: limit, daily_profile_view_limit: limit,
    } } },
  } });
  (useAppData as jest.Mock).mockReturnValue({ sentInterests: [] });
  let allowance: ReturnType<typeof usePlanAllowance>;
  function Probe() { allowance = usePlanAllowance(); return null; }
  let root: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(React.createElement(Probe)); });
  expect(allowance!.interestsLimit).toBe(limit);
  expect(allowance!.viewsLimit).toBe(limit);
  expect(allowance!.isInterestsUnlimited).toBe(false);
  expect(allowance!.isViewsUnlimited).toBe(false);
  await act(async () => { root!.unmount(); });
});
