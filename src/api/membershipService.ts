/**
 * MyDearPartner — Membership Plans Service
 *
 * Fetches dynamic membership plans and entitlements directly from the Django backend database.
 * When an admin updates plan limits or features in the backend, this service fetches
 * and reflects the latest values immediately.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SESSION_STORAGE_SUFFIX } from '../config/env';
import { get } from './apiClient';

const CACHE_KEY = `@mydearpartner_cached_membership_plans${SESSION_STORAGE_SUFFIX}`;

export interface DynamicPlanLimits {
  dailyInterests: number; // Infinity for unlimited
  dailyProfileViews: number; // Infinity for unlimited
  contactUnlocks: number;
}

export interface BackendMembershipPlan {
  id: string;
  slug: string;
  name: string;
  badge?: string;
  recommended?: boolean;
  price?: string | number;
  original_price?: string | number;
  duration_days?: number;
  duration?: string;
  features?: string[];
  contact_unlocks?: number;
  daily_interests_limit?: number;
  daily_profile_views_limit?: number;
  limits?: Record<string, any>;
  entitlements?: Record<string, any>;
  [key: string]: any;
}

let _inMemoryPlans: BackendMembershipPlan[] | null = null;
let _planSubscribers: Array<(plans: BackendMembershipPlan[]) => void> = [];

export function subscribeToPlanUpdates(
  callback: (plans: BackendMembershipPlan[]) => void,
): () => void {
  _planSubscribers.push(callback);
  if (_inMemoryPlans) {
    callback(_inMemoryPlans);
  }
  return () => {
    _planSubscribers = _planSubscribers.filter(cb => cb !== callback);
  };
}

function notifySubscribers(plans: BackendMembershipPlan[]) {
  _planSubscribers.forEach(cb => {
    try {
      cb(plans);
    } catch (e) {
      console.warn('[MembershipService] Subscriber error:', e);
    }
  });
}

/**
 * Extract numerical limits from feature descriptions if admin entered them as text
 * e.g., "40 Interests per Day", "30 Daily Interests", "Unlimited Interests",
 * "100 Profile Views per Day", "Unlock 60 Contacts"
 */
export function extractLimitsFromFeatures(
  features?: string[],
): Partial<DynamicPlanLimits> {
  if (!Array.isArray(features) || features.length === 0) return {};

  const result: Partial<DynamicPlanLimits> = {};

  for (const item of features) {
    if (typeof item !== 'string') continue;
    const text = item.trim();

    // Interests
    if (/unlimited\s*(?:daily\s*)?interest/i.test(text)) {
      result.dailyInterests = Infinity;
    } else {
      const match =
        text.match(/(\d+)\s*(?:daily\s*)?interest/i) ||
        text.match(/(\d+)\s*interest(?:s)?\s*daily/i) ||
        text.match(/(?:send\s*)?(\d+)\s*interest/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val)) result.dailyInterests = val;
      }
    }

    // Profile Views
    if (/unlimited\s*(?:daily\s*)?(?:profile\s*)?view/i.test(text)) {
      result.dailyProfileViews = Infinity;
    } else {
      const match =
        text.match(/(\d+)\s*(?:daily\s*)?(?:profile\s*)?view/i) ||
        text.match(/(?:view\s*)?(\d+)\s*(?:profile\s*)?view/i) ||
        text.match(/view\s*up\s*to\s*(\d+)\s*profile/i);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val)) result.dailyProfileViews = val;
      }
    }

    // Contact Unlocks
    const contactMatch =
      text.match(/(?:unlock\s*)?(\d+)\s*(?:direct\s*)?contact/i) ||
      text.match(/(\d+)\s*contact\s*unlock/i) ||
      text.match(/unlock\s*(\d+)\s*contact/i);
    if (contactMatch) {
      const val = parseInt(contactMatch[1], 10);
      if (!isNaN(val)) result.contactUnlocks = val;
    }
  }

  return result;
}

/**
 * Resolves dynamic limits for a plan object from the database.
 * Evaluates direct database columns first, then nested limits/entitlements,
 * then parsed feature strings configured by the admin.
 */
export function resolvePlanLimits(
  plan?: BackendMembershipPlan | null,
  fallbackSlug?: string,
): DynamicPlanLimits {
  const cleanSlug = (plan?.slug || fallbackSlug || '').toLowerCase();
  const isPlatinum =
    cleanSlug.includes('plat') ||
    cleanSlug.includes('elite') ||
    cleanSlug.includes('diamond');

  // Default fallbacks matching active backend DB setup
  const defaults: DynamicPlanLimits = {
    dailyInterests: isPlatinum ? Infinity : cleanSlug === 'free' ? 3 : 15,
    dailyProfileViews: isPlatinum ? Infinity : cleanSlug === 'free' ? 10 : 50,
    contactUnlocks: isPlatinum ? 150 : cleanSlug === 'free' ? 10 : 50,
  };

  if (!plan || typeof plan !== 'object') return defaults;

  // 1. Direct or nested DB numbers from Django schema
  const dbInterests =
    plan.entitlements?.daily_interest_limit ??
    plan.interest_limit_daily ??
    plan.interest_limit ??
    plan.limits?.daily_interest_limit ??
    plan.limits?.interest_limit_daily ??
    plan.daily_interests_limit ??
    plan.daily_interest_limit ??
    plan.daily_interests ??
    plan.entitlements?.daily_interests_limit ??
    plan.entitlements?.daily_interests;

  const dbViews =
    plan.entitlements?.daily_profile_view_limit ??
    plan.profile_view_limit_daily ??
    plan.limits?.daily_profile_view_limit ??
    plan.limits?.profile_view_limit_daily ??
    plan.daily_profile_views_limit ??
    plan.daily_profile_view_limit ??
    plan.daily_views_limit ??
    plan.profile_views_limit ??
    plan.entitlements?.daily_profile_views ??
    plan.entitlements?.profile_views_limit;

  const dbUnlocks =
    plan.daily_profile_unlock_limit ??
    plan.contact_unlocks ??
    plan.contact_unlocks_limit ??
    plan.limits?.daily_profile_unlock_limit ??
    plan.limits?.contact_unlocks ??
    plan.entitlements?.daily_profile_unlock_limit ??
    plan.entitlements?.contact_unlocks;

  // 2. Parse features text if admin wrote them in plan features
  const parsed = extractLimitsFromFeatures(plan.features);

  // Helper to safely parse numeric limits
  const parseNumOrUnlimited = (
    val: any,
    parsedFallback?: number,
    defaultFallback: number = 0,
  ): number => {
    if (val != null) {
      const num = Number(val);
      if (num === -1 || (num === 0 && isPlatinum)) return Infinity;
      if (!isNaN(num) && num > 0) return num;
      if (num === 0) return 0;
    }
    if (parsedFallback != null) return parsedFallback;
    return defaultFallback;
  };

  return {
    dailyInterests: parseNumOrUnlimited(
      dbInterests,
      parsed.dailyInterests,
      defaults.dailyInterests,
    ),
    dailyProfileViews: parseNumOrUnlimited(
      dbViews,
      parsed.dailyProfileViews,
      defaults.dailyProfileViews,
    ),
    contactUnlocks: parseNumOrUnlimited(
      dbUnlocks,
      parsed.contactUnlocks,
      defaults.contactUnlocks,
    ),
  };
}

/**
 * Fetch dynamic membership plans directly from database API (/membership-plans/).
 * Caches in AsyncStorage for instantaneous offline retrieval.
 */
export async function fetchMembershipPlansFromBackend(): Promise<
  BackendMembershipPlan[]
> {
  try {
    const response = await get<any>('/membership-plans/');
    const rawPlans: any[] = Array.isArray(response)
      ? response
      : Array.isArray(response?.results)
      ? response.results
      : Array.isArray(response?.data)
      ? response.data
      : [];

    if (rawPlans.length > 0) {
      // Exclude any obsolete non-existent plan like silver
      const filtered = rawPlans.filter(p => {
        const slug = (p.slug || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return !slug.includes('silver') && !name.includes('silver');
      });

      _inMemoryPlans = filtered;
      notifySubscribers(filtered);
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify(filtered)).catch(() => {});
      return filtered;
    }
  } catch (err) {
    console.warn(
      '[MembershipService] Error fetching membership plans from backend:',
      err,
    );
  }

  // If network call failed, try cache
  if (_inMemoryPlans) return _inMemoryPlans;
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _inMemoryPlans = parsed;
        notifySubscribers(parsed);
        return parsed;
      }
    }
  } catch {}

  return [];
}

/**
 * Get the latest known membership plans (memory or cache).
 */
export async function getCachedMembershipPlans(): Promise<
  BackendMembershipPlan[]
> {
  if (_inMemoryPlans && _inMemoryPlans.length > 0) {
    return _inMemoryPlans;
  }
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        _inMemoryPlans = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
}
