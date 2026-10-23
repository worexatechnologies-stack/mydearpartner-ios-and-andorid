/**
 * MyDearPartner — In-App Rating Prompt
 *
 * Prompts users to rate the app on Play Store / App Store after
 * meaningful engagement milestones:
 *   - First mutual match (interest accepted)
 *   - After 7 days of usage
 *   - After 5 conversations started
 *
 * Uses AsyncStorage to track prompt state and prevent excessive prompting.
 * Respects user dismissals (max 2 prompts, then stops).
 */

import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForUpdate } from './forceUpdate';
import { SESSION_STORAGE_SUFFIX } from '../config/env';

const STORAGE_KEY = `@mydearpartner_rating_prompt${SESSION_STORAGE_SUFFIX}`;

interface RatingState {
  /** Number of times the prompt has been shown */
  promptCount: number;
  /** Whether user has already rated */
  hasRated: boolean;
  /** Timestamp of first app open */
  firstOpenAt: string;
  /** Timestamp of last prompt */
  lastPromptAt?: string;
  /** Number of conversations started */
  conversationCount: number;
  /** Number of mutual matches */
  matchCount: number;
}

const DEFAULT_STATE: RatingState = {
  promptCount: 0,
  hasRated: false,
  firstOpenAt: new Date().toISOString(),
  conversationCount: 0,
  matchCount: 0,
};

async function getState(): Promise<RatingState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE };
}

async function saveState(state: RatingState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/**
 * Record a new conversation started. Call this when the user sends their first
 * message in a new chat.
 */
export async function recordConversation(): Promise<void> {
  const state = await getState();
  state.conversationCount += 1;
  await saveState(state);
  await maybeShowPrompt(state);
}

/**
 * Record a mutual match (interest accepted by the other side).
 */
export async function recordMatch(): Promise<void> {
  const state = await getState();
  state.matchCount += 1;
  await saveState(state);
  await maybeShowPrompt(state);
}

/**
 * Record first app open (call on splash/auth completion).
 */
export async function recordFirstOpen(): Promise<void> {
  const state = await getState();
  if (!state.firstOpenAt || state.firstOpenAt === DEFAULT_STATE.firstOpenAt) {
    state.firstOpenAt = new Date().toISOString();
    await saveState(state);
  }
}

/**
 * Check daily conditions and maybe show a prompt.
 * Call this once per app foreground event.
 */
export async function checkRatingEligibility(): Promise<void> {
  const state = await getState();
  await maybeShowPrompt(state);
}

async function maybeShowPrompt(state: RatingState): Promise<void> {
  // Already rated or max prompts reached
  if (state.hasRated || state.promptCount >= 2) return;

  // Don't prompt within 7 days of last prompt
  if (state.lastPromptAt) {
    const daysSinceLastPrompt =
      (Date.now() - new Date(state.lastPromptAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPrompt < 7) return;
  }

  // Check eligibility conditions
  const daysSinceFirstOpen =
    (Date.now() - new Date(state.firstOpenAt).getTime()) / (1000 * 60 * 60 * 24);

  const eligible =
    state.matchCount >= 1 ||                    // First mutual match
    daysSinceFirstOpen >= 7 ||                  // 7 days of usage
    state.conversationCount >= 5;               // 5 conversations

  if (!eligible) return;

  const { updateUrl, updateRequired } = await checkForUpdate();
  if (!updateUrl || updateRequired) return;

  // Show the prompt
  state.promptCount += 1;
  state.lastPromptAt = new Date().toISOString();
  await saveState(state);

  Alert.alert(
    'Enjoying My Dear Partner? 💕',
    'Your feedback helps us build better matchmaking for everyone. Would you mind taking a moment to rate us?',
    [
      {
        text: 'Not Now',
        style: 'cancel',
      },
      {
        text: 'Never Ask Again',
        onPress: async () => {
          const s = await getState();
          s.hasRated = true; // Treat "never ask" same as rated
          await saveState(s);
        },
      },
      {
        text: 'Rate Us ⭐',
        onPress: async () => {
          try {
            await Linking.openURL(updateUrl);
            const s = await getState();
            s.hasRated = true;
            await saveState(s);
          } catch {
            Alert.alert('Could not open the store', 'Please open the app store and search for My Dear Partner.');
          }
        },
      },
    ],
  );
}
