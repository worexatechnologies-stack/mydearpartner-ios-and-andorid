import { sharedMatchReasons } from '../src/utils/matchReasons';
import { Profile } from '../src/types/models';
const profile = (value: Partial<Profile>) => value as Profile;
test('candidate-only education, work, and diet are not match reasons', () => {
  expect(sharedMatchReasons(profile({ city: 'Delhi' }), profile({ city: 'Mumbai', education: 'MBA', profession: 'Engineer', diet: 'Vegetarian' }))).toEqual([]);
});
test('shared supplied facts ignore case, whitespace, and recognized city aliases', () => {
  expect(sharedMatchReasons(profile({ city: 'Bengaluru', education: ' mba ', profession: 'Engineer', diet: 'Vegetarian' }), profile({ city: 'Bangalore', education: 'MBA', profession: ' engineer ', lifestyle: { diet: 'vegetarian' } }))).toEqual(['Same City: Bangalore', 'Education: MBA', 'Profession: engineer', 'Diet: vegetarian']);
});
test('missing profiles and empty attributes cannot generate reasons', () => {
  expect(sharedMatchReasons(null, profile({ education: 'MBA' }))).toEqual([]);
  expect(sharedMatchReasons(profile({ education: ' ' }), profile({ education: ' ' }))).toEqual([]);
});
test('placeholder values do not count as shared supplied facts', () => {
  expect(sharedMatchReasons(profile({ city: 'Unknown', education: 'N/A', diet: 'Not provided' }), profile({ city: 'Unknown', education: 'N/A', diet: 'Not provided' }))).toEqual([]);
});
