import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback,useEffect,useState } from 'react';
import {
BackendMembershipPlan,
fetchMembershipPlansFromBackend,
getCachedMembershipPlans,
resolvePlanLimits,
subscribeToPlanUpdates,
} from '../api/membershipService';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';

export interface PlanAllowanceConfig {
  slug: string;
  name: string;
  badge: string;
  accentColor: string;
  dailyInterests: number; // Infinity for unlimited
  dailyProfileViews: number; // Infinity for unlimited
  contactUnlocks: number;
}

/**
 * Baseline styling tokens for tiers (Free, Gold, Platinum).
 * Numerical limits are strictly dynamic and pulled from the database.
 */
export const BASE_PLAN_THEMES: Record<
  string,
  { badge: string; accentColor: string; defaultName: string }
> = {
  free: {
    badge: 'FREE PLAN',
    accentColor: '#64748B',
    defaultName: 'Free Basic',
  },
  gold: {
    badge: 'GOLD VIP',
    accentColor: '#F59E0B',
    defaultName: 'Gold VIP',
  },
  platinum: {
    badge: 'PLATINUM',
    accentColor: '#8B5CF6',
    defaultName: 'Platinum Elite',
  },
};

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(now.getDate()).padStart(2, '0')}`;
}

const STORAGE_KEY_PREFIX = '@mydearpartner_daily_views_';
const STORAGE_INTERESTS_SENT_PREFIX = '@mydearpartner_daily_interests_sent_';
const STORAGE_INTERESTS_EXHAUSTED_PREFIX =
  '@mydearpartner_daily_interests_exhausted_';

type Usage = { views: number; exhausted: boolean; sent: number };
const usageByAccount = new Map<string, Usage>();
const usageListeners = new Map<string, Set<(usage: Usage) => void>>();
const emptyUsage: Usage = { views: 0, exhausted: false, sent: 0 };
const usageKey = (accountId: string) => `${encodeURIComponent(accountId)}_${getTodayKey()}`;
const cachedUsage = (accountId: string) => usageByAccount.get(usageKey(accountId)) ?? emptyUsage;
function publishUsage(accountId: string, change: Partial<Usage>) {
  const usage = { ...cachedUsage(accountId), ...change };
  usageByAccount.set(usageKey(accountId), usage);
  usageListeners.get(accountId)?.forEach(listener => listener(usage));
}
function storageKey(prefix: string, accountId: string) {
  if (!accountId) throw new Error('Sign in to access your allowance.');
  return `${prefix}${usageKey(accountId)}`;
}

export async function isDailyInterestsExhaustedToday(accountId: string): Promise<boolean> {
  return (await AsyncStorage.getItem(storageKey(STORAGE_INTERESTS_EXHAUSTED_PREFIX, accountId))) === 'true';
}
export async function markDailyInterestsExhausted(exhausted: boolean, accountId: string): Promise<void> {
  const key = storageKey(STORAGE_INTERESTS_EXHAUSTED_PREFIX, accountId);
  publishUsage(accountId, { exhausted });
  if (exhausted) await AsyncStorage.setItem(key, 'true');
  else await AsyncStorage.removeItem(key);
}
async function readIds(prefix: string, accountId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(storageKey(prefix, accountId));
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}
// Serialize read/modify/write operations so rapid actions cannot lose usage.
const writes = new Map<string, Promise<unknown>>();
function recordId(prefix: string, accountId: string, id: string): Promise<string[]> {
  const key = storageKey(prefix, accountId);
  const operation = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const existing = await readIds(prefix, accountId);
    const updated = existing.includes(id) ? existing : [...existing, id];
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    return updated;
  });
  writes.set(key, operation);
  return operation;
}
export async function getDailyInterestsSentCountToday(accountId: string): Promise<number> {
  return (await readIds(STORAGE_INTERESTS_SENT_PREFIX, accountId)).length;
}
export async function recordInterestSentToday(toProfileId: string, accountId: string): Promise<number> {
  if (!toProfileId) return cachedUsage(accountId).sent;
  const ids = await recordId(STORAGE_INTERESTS_SENT_PREFIX, accountId, toProfileId);
  publishUsage(accountId, { sent: ids.length });
  return ids.length;
}
export function getViewedProfileIdsToday(accountId: string): Promise<string[]> {
  return readIds(STORAGE_KEY_PREFIX, accountId);
}
export async function recordProfileViewToday(profileId: string, accountId: string): Promise<string[]> {
  if (!profileId) return [];
  const ids = await recordId(STORAGE_KEY_PREFIX, accountId, profileId);
  publishUsage(accountId, { views: ids.length });
  return ids;
}
export async function resetViewsUsageToday(accountId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(STORAGE_KEY_PREFIX, accountId));
  publishUsage(accountId, { views: 0 });
}

/**
 * Hook to read current user's daily plan allowance, used views & interests, and remaining quotas.
 * Dynamically resolves whatever the admin has configured in the database / admin panel!
 */
export function usePlanAllowance() {
  const { currentUser } = useAuth();
  const { sentInterests } = useAppData();
  const accountId = currentUser?.id ?? '';
  const [usage, setUsage] = useState<Usage>(() => cachedUsage(accountId));
  const { views: viewsUsed, exhausted: isServerExhausted, sent: localSentCount } = usage;
  const [backendPlans, setBackendPlans] = useState<BackendMembershipPlan[]>([]);

  const profile = currentUser?.profile;
  const activeMembership = profile?.activeMembership;

  const rawSlug = (
    activeMembership?.plan_slug ||
    currentUser?.planSlug ||
    profile?.currentPlanSlug ||
    'free'
  )
    .toLowerCase()
    .trim();

  // Premium is only true if active AND not on free plan
  const isPremium = Boolean(
    (activeMembership?.is_active === true ||
      currentUser?.isPremium ||
      profile?.isPremium) &&
      rawSlug !== 'free' &&
      rawSlug !== '',
  );

  const planSlug = isPremium ? rawSlug : 'free';

  // 1. Subscribe to backend plans and fetch latest from DB on mount
  useEffect(() => {
    getCachedMembershipPlans().then(cached => {
      if (cached.length > 0) setBackendPlans(cached);
    });

    fetchMembershipPlansFromBackend().then(fresh => {
      if (fresh.length > 0) setBackendPlans(fresh);
    });

    const unsubscribe = subscribeToPlanUpdates(plans => {
      setBackendPlans(plans);
    });

    return unsubscribe;
  }, []);

  const refreshUsage = useCallback(async () => {
    if (!accountId) return;
    try {
      const [ids, exhausted, sent] = await Promise.all([
        getViewedProfileIdsToday(accountId),
        isDailyInterestsExhaustedToday(accountId),
        getDailyInterestsSentCountToday(accountId),
      ]);
      publishUsage(accountId, { views: ids.length, exhausted, sent });
    } catch {
      // Retain in-memory usage if device storage is temporarily unavailable.
    }
    await fetchMembershipPlansFromBackend();
  }, [accountId]);

  useEffect(() => {
    setUsage(cachedUsage(accountId));
    if (!accountId) return;
    const listeners = usageListeners.get(accountId) ?? new Set();
    listeners.add(setUsage);
    usageListeners.set(accountId, listeners);
    refreshUsage().catch(() => {});
    return () => { listeners.delete(setUsage); };
  }, [accountId, refreshUsage]);

  // Find matching plan object from backend
  const matchingDbPlan = backendPlans.find(
    bp =>
      (bp.slug && bp.slug.toLowerCase() === planSlug) ||
      (bp.name && bp.name.toLowerCase().includes(planSlug)) ||
      (bp.id &&
        String(bp.id) ===
          String(activeMembership?.plan_id || activeMembership?.id)),
  );

  // Check if active_membership itself carries plan data or custom limits from the database
  const membershipPlanOrCustom =
    (activeMembership?.plan && typeof activeMembership.plan === 'object'
      ? activeMembership.plan
      : null) || matchingDbPlan;

  // Resolve dynamic limits from the database
  const dynamicLimits = resolvePlanLimits(membershipPlanOrCustom, planSlug);

  // User-specific or active membership override limits from Django
  const userOverrideInterests =
    activeMembership?.entitlements?.daily_interest_limit ??
    activeMembership?.interest_limit_daily ??
    activeMembership?.interest_limit ??
    activeMembership?.daily_interests_limit ??
    activeMembership?.daily_interest_limit ??
    activeMembership?.limits?.daily_interest_limit ??
    activeMembership?.limits?.daily_interests_limit ??
    activeMembership?.limits?.interest_limit_daily ??
    activeMembership?.limits?.daily_interests;

  const userOverrideViews =
    activeMembership?.entitlements?.daily_profile_view_limit ??
    activeMembership?.profile_view_limit_daily ??
    activeMembership?.daily_profile_views_limit ??
    activeMembership?.daily_profile_view_limit ??
    activeMembership?.daily_views_limit ??
    activeMembership?.limits?.daily_profile_view_limit ??
    activeMembership?.limits?.daily_profile_views_limit ??
    activeMembership?.limits?.profile_view_limit_daily ??
    activeMembership?.limits?.daily_views_limit;

  const userOverrideUnlocks =
    activeMembership?.daily_profile_unlock_limit ??
    activeMembership?.contact_unlocks ??
    activeMembership?.limits?.contact_unlocks ??
    activeMembership?.limits?.daily_profile_unlock_limit ??
    activeMembership?.entitlements?.daily_profile_unlock_limit ??
    activeMembership?.entitlements?.contact_unlocks ??
    profile?.contactUnlocks;

  const resolveNumericLimit = (
    overrideVal: any,
    dynamicVal: number,
    fallback: number,
  ): number => {
    if (overrideVal != null) {
      const num = Number(overrideVal);
      if (num === -1) return Infinity;
      if (!isNaN(num) && num >= 0) return num;
    }
    if (dynamicVal != null && !isNaN(dynamicVal)) return dynamicVal;
    return fallback;
  };

  const finalInterestsLimit = resolveNumericLimit(
    userOverrideInterests,
    dynamicLimits.dailyInterests,
    3,
  );
  const finalViewsLimit = resolveNumericLimit(
    userOverrideViews,
    dynamicLimits.dailyProfileViews,
    10,
  );
  const finalContactUnlocks = resolveNumericLimit(
    userOverrideUnlocks,
    dynamicLimits.contactUnlocks,
    10,
  );

  // Resolve plan metadata (name, badge, accent color)
  const isPlatinum =
    planSlug.includes('plat') ||
    planSlug.includes('elite') ||
    planSlug.includes('diamond');
  const isGold = planSlug.includes('gold') || (!isPlatinum && isPremium);
  const baseTheme = isPlatinum
    ? BASE_PLAN_THEMES.platinum
    : isGold
    ? BASE_PLAN_THEMES.gold
    : BASE_PLAN_THEMES.free;

  const planName =
    activeMembership?.plan_name ||
    matchingDbPlan?.name ||
    baseTheme.defaultName;

  const planBadge =
    matchingDbPlan?.badge && matchingDbPlan.badge.trim().length > 0
      ? matchingDbPlan.badge.trim()
      : baseTheme.badge;

  const planConfig: PlanAllowanceConfig = {
    slug: planSlug,
    name: planName,
    badge: planBadge,
    accentColor: baseTheme.accentColor,
    dailyInterests: finalInterestsLimit,
    dailyProfileViews: finalViewsLimit,
    contactUnlocks: finalContactUnlocks,
  };

  // Compute interests sent today (from midnight 00:00 to now) from actual DB interests
  const dbInterestsUsed = (() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startTs = startOfToday.getTime();
    return (sentInterests ?? []).filter(item => {
      if (!item) return false;
      const ts =
        typeof item.createdAt === 'number'
          ? item.createdAt
          : new Date(item.createdAt || 0).getTime();
      return !isNaN(ts) && ts >= startTs;
    }).length;
  })();

  const rawInterestsUsed = Math.max(dbInterestsUsed, localSentCount);

  // Interests Remaining
  const isInterestsUnlimited = planConfig.dailyInterests === Infinity;
  const interestsLimit = isInterestsUnlimited
    ? Infinity
    : Math.max(0, planConfig.dailyInterests);

  // If server reported daily limit exhaustion OR used count meets/exceeds limit:
  const isInterestsExhausted =
    !isInterestsUnlimited &&
    (isServerExhausted ||
      (typeof interestsLimit === 'number' &&
        rawInterestsUsed >= interestsLimit));

  const interestsUsed = isInterestsExhausted
    ? typeof interestsLimit === 'number'
      ? Math.max(interestsLimit, rawInterestsUsed)
      : rawInterestsUsed
    : rawInterestsUsed;

  const interestsRemaining: number | 'Unlimited' = isInterestsUnlimited
    ? 'Unlimited'
    : isInterestsExhausted
    ? 0
    : Math.max(0, interestsLimit - interestsUsed);

  const interestsPercent = isInterestsUnlimited
    ? 100
    : isInterestsExhausted
    ? 100
    : Math.min(
        100,
        Math.round((interestsUsed / Math.max(1, interestsLimit)) * 100),
      );

  // Profile Views Remaining
  const isViewsUnlimited = planConfig.dailyProfileViews === Infinity;
  const viewsLimit = isViewsUnlimited
    ? Infinity
    : Math.max(0, planConfig.dailyProfileViews);
  const viewsRemaining: number | 'Unlimited' = isViewsUnlimited
    ? 'Unlimited'
    : Math.max(0, viewsLimit - viewsUsed);
  const isViewsExhausted =
    !isViewsUnlimited &&
    typeof viewsRemaining === 'number' &&
    viewsRemaining <= 0;
  const viewsPercent = isViewsUnlimited
    ? 100
    : Math.min(100, Math.round((viewsUsed / Math.max(1, viewsLimit)) * 100));

  const contactUnlocksRemaining = planConfig.contactUnlocks;

  const recordView = useCallback(async (profileId: string) => {
    await recordProfileViewToday(profileId, accountId).catch(() => {});
  }, [accountId]);
  const markExhausted = useCallback((exhausted = true) =>
    markDailyInterestsExhausted(exhausted, accountId).catch(() => {}), [accountId]);
  const recordInterest = useCallback((profileId: string) =>
    recordInterestSentToday(profileId, accountId), [accountId]);

  return {
    planConfig,
    planSlug,
    planName: planConfig.name,
    isPremium,
    backendPlans,
    // Interests
    interestsLimit,
    interestsUsed,
    interestsRemaining,
    isInterestsUnlimited,
    isInterestsExhausted,
    interestsPercent,
    // Views
    viewsLimit,
    viewsUsed,
    viewsRemaining,
    isViewsUnlimited,
    isViewsExhausted,
    viewsPercent,
    // Unlocks
    contactUnlocksRemaining,
    // Actions
    recordView,
    refreshUsage,
    markDailyInterestsExhausted: markExhausted,
    recordInterestSentToday: recordInterest,
  };
}
