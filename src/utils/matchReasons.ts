import { Profile } from '../types/models';
import { sameProfileCity } from './profileLocation';

const supplied = (value?: string): value is string => typeof value === 'string' && Boolean(value.trim()) &&
  !/^(unknown|not provided|not specified|n\/a|none|-)$/i.test(value.trim());
const same = (a?: string, b?: string) => supplied(a) && supplied(b) && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/** Reasons describe shared supplied attributes, never candidate-only facts. */
export function sharedMatchReasons(mine?: Profile | null, theirs?: Profile | null): string[] {
  if (!mine || !theirs) return [];
  const reasons: string[] = [];
  if (supplied(mine.city) && supplied(theirs.city) && sameProfileCity(mine.city, theirs.city)) reasons.push(`Same City: ${theirs.city.trim()}`);
  for (const [label, a, b] of [
    ['Language', mine.motherTongue, theirs.motherTongue],
    ['Community', mine.religion, theirs.religion],
    ['Education', mine.education, theirs.education],
    ['Profession', mine.profession, theirs.profession],
    ['Diet', mine.lifestyle?.diet || mine.diet, theirs.lifestyle?.diet || theirs.diet],
  ]) if (same(a, b)) reasons.push(`${label}: ${b!.trim()}`);
  return reasons.slice(0, 4);
}
