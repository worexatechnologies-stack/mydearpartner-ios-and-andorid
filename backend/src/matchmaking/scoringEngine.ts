import { CompatibilityResult, FactorScore, MatchProfile } from './types';

const clean = (value?: string) => typeof value === 'string' ? value.trim().toLowerCase() : '';

/** Explainable similarity of supplied facts; absent fields never receive points. */
export function calculateDeterministicCompatibility(a: MatchProfile, b: MatchProfile): CompatibilityResult {
  const pairs: [string, string | undefined, string | undefined][] = [
    ['City', a.city, b.city], ['Language', a.motherTongue, b.motherTongue],
    ['Education', a.education, b.education], ['Profession', a.profession, b.profession],
    ['Diet', a.lifestyle?.diet || a.diet, b.lifestyle?.diet || b.diet],
  ];
  const breakdown: FactorScore[] = pairs.map(([label, x, y]) => {
    const applicable = Boolean(clean(x) && clean(y));
    const same = applicable && clean(x) === clean(y);
    return {
      factor: label.toLowerCase(), label, weight: 1, applicable,
      score: same ? 1 : 0, earnedPoints: same ? 1 : 0,
      strength: same ? `Shared ${label.toLowerCase()}: ${x?.trim()}` : undefined,
      consideration: applicable && !same ? `${label} differs between the profiles; discuss what matters to you.` : undefined,
    };
  });
  if (a.interests?.length && b.interests?.length) {
    const mine = new Set(a.interests.map(clean).filter(Boolean));
    const theirs = new Set(b.interests.map(clean).filter(Boolean));
    const shared = [...mine].filter(value => theirs.has(value));
    const union = new Set([...mine, ...theirs]);
    const score = union.size ? shared.length / union.size : 0;
    breakdown.push({ factor: 'interests', label: 'Interests', weight: 1, applicable: union.size > 0,
      score, earnedPoints: score,
      strength: shared.length ? `Shared interests: ${shared.join(', ')}` : undefined });
  }
  // Explicit preferences are directional: evaluate each member's stated choices.
  for (const [owner, candidate, direction] of [[a, b, 'Your'], [b, a, 'Their']] as const) {
    const preferences = owner.partnerPreferences;
    if (!preferences) continue;
    const add = (key: string, label: string, applicable: boolean, matched: boolean) => {
      breakdown.push({ factor: `${direction.toLowerCase()}_preference_${key}`,
        label: `${direction} preference: ${label}`, weight: 1, applicable,
        score: matched ? 1 : 0, earnedPoints: applicable && matched ? 1 : 0,
        strength: applicable && matched ? `${direction} stated ${label.toLowerCase()} preference is met.` : undefined,
        consideration: applicable && !matched ? `${direction} stated ${label.toLowerCase()} preference differs.` : undefined });
    };
    for (const key of ['city', 'state', 'motherTongue', 'education', 'profession', 'diet', 'maritalStatus'] as const) {
      const choices = preferences[key]?.map(clean).filter(Boolean);
      if (!choices?.length) continue;
      const value = clean(key === 'diet' ? candidate.lifestyle?.diet || candidate.diet : candidate[key]);
      add(key, key === 'motherTongue' ? 'Language' : key, Boolean(value), choices.includes(value));
    }
    if (preferences.minAge !== undefined || preferences.maxAge !== undefined) {
      const age = candidate.age;
      add('age', 'Age', typeof age === 'number' && Number.isFinite(age),
        typeof age === 'number' && age >= (preferences.minAge ?? 18) && age <= (preferences.maxAge ?? 120));
    }
  }
  const applicable = breakdown.filter(f => f.applicable);
  const dataCompleteness = Math.round(applicable.length / (6 + breakdown.filter(f => f.factor.includes('_preference_')).length) * 100);
  const score = applicable.length ? Math.round(applicable.reduce((sum, f) => sum + f.earnedPoints, 0) / applicable.length * 100) : null;
  return {
    candidateId: b.id, compatibilityScore: score,
    confidence: dataCompleteness >= 80 ? 'high' : dataCompleteness >= 50 ? 'medium' : 'low',
    dataCompleteness, factorBreakdown: breakdown,
    sharedStrengths: breakdown.flatMap(f => f.strength ? [f.strength] : []),
    considerations: [...breakdown.flatMap(f => f.consideration ? [f.consideration] : []),
      ...breakdown.filter(f => !f.applicable).map(f => `${f.label} is missing from one or both profiles.`)],
    summary: score === null ? 'Not enough information for a profile similarity score.' : `Profile comparison: ${score}% across ${applicable.length} comparable attributes.`,
    explanation: 'This equally weights comparable profile facts and supported explicit preferences from both members; it does not predict relationship suitability. Missing information is excluded, and shared attributes do not predict a successful relationship. Confidence describes data completeness.',
    isAiEnhanced: false, calculatedAt: new Date().toISOString(),
  };
}
