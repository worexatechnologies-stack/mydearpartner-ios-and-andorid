import { get, post } from './apiClient';

export interface MatchCapabilities {
  service: 'match-insights';
  version: 1;
  aiConfigured: boolean;
}

/** Availability check sends no candidate information and never calls Gemini. */
export async function getMatchCapabilities(): Promise<MatchCapabilities> {
  const raw = await get<any>('/matches/capabilities/');
  const result = raw?.data ?? raw;
  if (result?.service !== 'match-insights' || result?.version !== 1 || typeof result?.aiConfigured !== 'boolean') {
    throw new Error('Match insights are temporarily unavailable.');
  }
  return result;
}

export function matchInsightsFailure(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return 'Please sign in again to request AI insights.';
  if (status === 403) return 'AI insights are not available for this profile.';
  if (status === 429) return 'Please wait a minute before requesting more insights.';
  if (status === 404 || status === 405 || status === 501) return 'AI insights are currently unavailable. Profile comparisons are still available.';
  if (status === 503) return 'The insights service is temporarily unavailable. Please try again later.';
  return 'Could not connect to AI insights. Check your connection and try again.';
}

export interface MatchInsights {
  candidateId: string;
  compatibilityScore: number | null;
  isAiEnhanced: boolean;
  summary: string;
  explanation: string;
  sharedStrengths: string[];
  considerations: string[];
  dataCompleteness: number;
}

/** The production reverse proxy must route /api/v1/matches to the matching service. */
export async function getMatchInsights(candidateId: string, useAi = false): Promise<MatchInsights> {
  const raw = await post<any>('/matches/compatibility/', { candidateId, useAi });
  const result = raw?.data ?? raw;
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string');
  if (!result || result.candidateId !== candidateId || typeof result.isAiEnhanced !== 'boolean' ||
      !(result.compatibilityScore === null || (typeof result.compatibilityScore === 'number' && Number.isFinite(result.compatibilityScore) && result.compatibilityScore >= 0 && result.compatibilityScore <= 100)) ||
      typeof result.summary !== 'string' || typeof result.explanation !== 'string' ||
      !strings(result.sharedStrengths) || !strings(result.considerations) ||
      typeof result.dataCompleteness !== 'number' || !Number.isFinite(result.dataCompleteness) || result.dataCompleteness < 0 || result.dataCompleteness > 100) {
    throw new Error('Match insights are unavailable. Profile comparisons are still shown.');
  }
  return result;
}
