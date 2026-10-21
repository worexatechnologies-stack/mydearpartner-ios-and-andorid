/** Profile facts and conversation prompts. No horoscope scores are inferred. */
import { Profile } from '../types/models';
import { computeCompatibilityScore } from '../utils/compatibility';

export interface ProfileComparison {
  label: string;
  yours?: string;
  theirs?: string;
  matched: boolean | null;
}
export interface GeminiHoroscopeAnalysis {
  source: 'profile';
  score: number | null;
  summary: string;
  comparisons: ProfileComparison[];
  sharedStrengths: string[];
  missingInformation: string[];
  conversationStarters: string[];
  horoscopeNotice: string;
}

const clean = (value?: string) => value?.trim() || undefined;

// Retain the export name for existing callers; this function never calls Gemini.
export function calculateGeminiHoroscopeMatch(
  mine?: Profile | null,
  theirs?: Profile | null,
): GeminiHoroscopeAnalysis {
  const fields: [string, string | undefined, string | undefined][] = [
    ['City', mine?.city, theirs?.city],
    ['Language', mine?.motherTongue, theirs?.motherTongue],
    ['Education', mine?.education, theirs?.education],
    ['Profession', mine?.profession, theirs?.profession],
    ['Diet', mine?.lifestyle?.diet || mine?.diet, theirs?.lifestyle?.diet || theirs?.diet],
  ];
  const comparisons = fields.map(([label, a, b]) => {
    const yours = clean(a), other = clean(b);
    return { label, yours, theirs: other, matched: yours && other ? yours.toLocaleLowerCase() === other.toLocaleLowerCase() : null };
  });
  const interests = (profile?: Profile | null) => (profile?.interests ?? [])
    .filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
  const myInterests = interests(mine), theirInterests = interests(theirs);
  const sharedInterests = myInterests.filter(item => theirInterests.some(other => other.toLocaleLowerCase() === item.toLocaleLowerCase()));
  comparisons.push({ label: 'Interests', yours: myInterests.join(', ') || undefined,
    theirs: theirInterests.join(', ') || undefined,
    matched: myInterests.length && theirInterests.length ? sharedInterests.length > 0 : null });
  const sharedStrengths = comparisons.filter(item => item.matched === true)
    .map(item => `Shared ${item.label.toLowerCase()}: ${item.label === 'Interests' ? sharedInterests.join(', ') : item.yours}`);
  const missingInformation = comparisons.filter(item => item.matched === null)
    .map(item => `${item.label}: ${!item.yours && !item.theirs ? 'missing from both profiles' : !item.yours ? 'missing from your profile' : 'missing from this profile'}`);
  const questions = [
    theirs?.profession ? `What do you enjoy about your work in ${theirs.profession}?` : 'What do you enjoy doing during the week?',
    'What values and expectations matter most to you in a partnership?',
    'How do you see your plans for family, work, and where to live?',
  ];
  return {
    source: 'profile', score: computeCompatibilityScore(theirs), comparisons,
    summary: 'These observations compare information you both provided. Similarities do not predict relationship success.',
    sharedStrengths, missingInformation, conversationStarters: questions,
    horoscopeNotice: 'Kundali and Guna Milan have not been calculated for this comparison.',
  };
}
