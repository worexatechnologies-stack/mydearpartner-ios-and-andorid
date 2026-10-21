import { calculateGeminiHoroscopeMatch } from '../src/services/geminiHoroscopeService';
import { Profile } from '../src/types/models';
const mine = { id: 'a', city: 'Bengaluru', education: 'MBA', profession: 'Engineer' } as Profile;
const theirs = { id: 'b', city: 'bengaluru', profession: 'Teacher', compatibilityScore: 75 } as Profile;

test('compares supplied facts and reports missing fields without invented horoscope scores', () => {
  const result = calculateGeminiHoroscopeMatch(mine, theirs);
  expect(result.source).toBe('profile');
  expect(result.score).toBe(75);
  expect(result.sharedStrengths).toContain('Shared city: Bengaluru');
  expect(result.missingInformation).toContain('Education: missing from this profile');
  expect(result).not.toHaveProperty('gunasScore');
  expect(result).not.toHaveProperty('harmonyPercentage');
  expect(result.horoscopeNotice).toContain('have not been calculated');
});
test('profile IDs cannot change compatibility observations', () => {
  const result = calculateGeminiHoroscopeMatch(mine, theirs);
  expect(calculateGeminiHoroscopeMatch({ ...mine, id: 'new' }, { ...theirs, id: 'new-b' })).toEqual(result);
});
test('empty profiles return unknown score and missing information', () => {
  const result = calculateGeminiHoroscopeMatch(null, null);
  expect(result.score).toBeNull();
  expect(result.sharedStrengths).toEqual([]);
  expect(result.missingInformation).toHaveLength(6);
  expect(result.comparisons.every(item => item.matched === null)).toBe(true);
});
test('different professions are not presented as a shared strength', () => {
  expect(calculateGeminiHoroscopeMatch(mine, theirs).sharedStrengths.join(' ')).not.toContain('profession');
});

test('shared interests exclude interests the other member did not list', () => {
  const result = calculateGeminiHoroscopeMatch({ ...mine, interests: ['Music', 'Walking'] }, { ...theirs, interests: ['music', 'Reading'] });
  expect(result.sharedStrengths).toContain('Shared interests: Music');
  expect(result.sharedStrengths.join(' ')).not.toContain('Walking');
});
