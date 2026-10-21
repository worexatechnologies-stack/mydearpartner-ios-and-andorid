/**
 * MyDearPartner — Analytics Service (Slide 21 Implementation)
 *
 * Implements the 9 mandatory analytics events defined in the Business, Product & Growth Plan:
 * 1. first_open
 * 2. registration_complete
 * 3. profile_complete
 * 4. recommendation_view
 * 5. interest_sent
 * 6. mutual_interest
 * 7. conversation_started
 * 8. subscription_state_changed
 * 9. report_submitted
 *
 * Strict Privacy Guarantees (Slide 21):
 * - Never includes free-text, message contents, or private personal identifiers.
 * - Categorical bands are used for latency and time-to-event metrics.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getAnalytics, logEvent as logFirebaseEvent } from '@react-native-firebase/analytics';

const STORAGE_KEY_FIRST_OPEN = '@mdp_analytics_first_open_logged';
const APP_VERSION = '0.3.3';

export type CountBand = '0' | '1-5' | '6-15' | '16-30' | '>30';
export type LatencyBand = '<200ms' | '200-500ms' | '500ms-1s' | '1-3s' | '>3s';
export type TimeToEventBand = '<1h' | '1-24h' | '1-7d' | '>7d' | 'unknown';

export interface FirstOpenParams {
  platform: typeof Platform.OS;
  app_version: string;
  source: string;
}

export interface RegistrationCompleteParams {
  source: string;
  platform: typeof Platform.OS;
  cohort: string;
}

export interface ProfileCompleteParams {
  completion_version: string;
}

export interface RecommendationViewParams {
  cohort: string;
  count_band: CountBand;
  response_latency?: LatencyBand;
}

export interface InterestSentParams {
  cohort: string;
  action_context: 'discover_feed' | 'profile_detail' | 'shortlist' | 'search';
}

export interface MutualInterestParams {
  time_to_event_band: TimeToEventBand;
}

export interface SubscriptionStateChangedParams {
  product_id: string;
  state: 'active' | 'expired' | 'canceled' | 'pending';
  platform: typeof Platform.OS;
}

export interface ReportSubmittedParams {
  restricted_category: string;
}

/**
 * Helper to compute count band
 */
export function getCountBand(count: number): CountBand {
  if (count <= 0) return '0';
  if (count <= 5) return '1-5';
  if (count <= 15) return '6-15';
  if (count <= 30) return '16-30';
  return '>30';
}

/**
 * Helper to compute time-to-event band from a timestamp in ms
 */
export function getTimeToEventBand(createdAtMs?: number): TimeToEventBand {
  if (!createdAtMs) return 'unknown';
  const diffMs = Math.max(0, Date.now() - createdAtMs);
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 1) return '<1h';
  if (diffHours <= 24) return '1-24h';
  if (diffHours <= 168) return '1-7d';
  return '>7d';
}

class AnalyticsService {
  private initialized = false;

  public async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.trackFirstOpen();
  }

  /**
   * Generic logging pipeline with safe fallback
   */
  public async logEvent(
    name: string,
    params: Record<string, any> = {},
  ): Promise<boolean> {
    try {
      // Never print event parameters: callers may accidentally supply personal data.
      await logFirebaseEvent(getAnalytics(), name, params);
      return true;
    } catch {
      if (__DEV__ && process.env.NODE_ENV !== 'test') {
        console.warn(`[Analytics] Could not record event: ${name}`);
      }
      return false;
    }
  }

  /**
   * 1. first_open
   * Dispatched exactly once per app installation.
   */
  public async trackFirstOpen(source = 'app_launch'): Promise<void> {
    try {
      const alreadyLogged = await AsyncStorage.getItem(STORAGE_KEY_FIRST_OPEN);
      if (alreadyLogged) return;

      const params: FirstOpenParams = {
        platform: Platform.OS,
        app_version: APP_VERSION,
        source,
      };
      const recorded = await this.logEvent('app_first_open', params);
      if (recorded) await AsyncStorage.setItem(STORAGE_KEY_FIRST_OPEN, 'true');
    } catch (err: any) {
      if (__DEV__ && process.env.NODE_ENV !== 'test') {
        console.warn('[Analytics] trackFirstOpen error:', err);
      }
    }
  }

  /**
   * 2. registration_complete
   * Dispatched when user finishes signup successfully.
   */
  public async trackRegistrationComplete(
    params: RegistrationCompleteParams,
  ): Promise<void> {
    await this.logEvent('registration_complete', {
      source: params.source,
      platform: params.platform,
      cohort: params.cohort,
    });
  }

  /**
   * 3. profile_complete
   * Dispatched upon successful submission of mandatory profile setup.
   * Privacy rule: Contains no free-text or sensitive personal data.
   */
  public async trackProfileComplete(
    params: ProfileCompleteParams = { completion_version: 'v1' },
  ): Promise<void> {
    await this.logEvent('profile_complete', {
      completion_version: params.completion_version,
    });
  }

  /**
   * 4. recommendation_view
   * Dispatched when discovery feed recommendations are displayed.
   */
  public async trackRecommendationView(
    params: RecommendationViewParams,
  ): Promise<void> {
    await this.logEvent('recommendation_view', {
      cohort: params.cohort,
      count_band: params.count_band,
      response_latency: params.response_latency || '<200ms',
    });
  }

  /**
   * 5. interest_sent
   * Dispatched when an interest request is submitted.
   * Privacy rule: Minimizes personal data; passes high-level cohort and context.
   */
  public async trackInterestSent(params: InterestSentParams): Promise<void> {
    await this.logEvent('interest_sent', {
      cohort: params.cohort,
      action_context: params.action_context,
    });
  }

  /**
   * 6. mutual_interest
   * Dispatched when reciprocated or accepted interest forms a mutual match.
   */
  public async trackMutualInterest(
    params: MutualInterestParams,
  ): Promise<void> {
    await this.logEvent('mutual_interest', {
      time_to_event_band: params.time_to_event_band,
    });
  }

  /**
   * 7. conversation_started
   * Strictly event-only: NEVER send message content.
   */
  public async trackConversationStarted(): Promise<void> {
    await this.logEvent('conversation_started', {});
  }

  /**
   * 8. subscription_state_changed
   * Dispatched upon successful purchase / membership state update.
   */
  public async trackSubscriptionStateChanged(
    params: SubscriptionStateChangedParams,
  ): Promise<void> {
    await this.logEvent('subscription_state_changed', {
      product_id: params.product_id,
      state: params.state,
      platform: params.platform,
    });
  }

  /**
   * 9. report_submitted
   * Restricted operational category for moderation safety.
   */
  public async trackReportSubmitted(
    params: ReportSubmittedParams,
  ): Promise<void> {
    await this.logEvent('report_submitted', {
      restricted_category: params.restricted_category,
    });
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService;
