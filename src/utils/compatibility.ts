import { Profile } from '../types/models';

/** Missing match data is unknown, never a fabricated compatibility claim. */
export function computeCompatibilityScore(profile?: Profile | null): number | null {
  const score = profile?.compatibilityScore;
  return typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100
    ? Math.round(score) : null;
}
