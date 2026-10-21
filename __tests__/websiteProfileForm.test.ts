import {
  websiteProfileValues,
  websiteProfileChanges,
} from '../src/utils/websiteProfileForm';
import { mapProfile } from '../src/api/profileService';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), patch: jest.fn() }));
const original = websiteProfileValues({
  name: 'Test Member',
  city: 'Pune',
  religion: 'Hindu',
});

test('unchanged website fields produce no update', () => {
  expect(websiteProfileChanges(original, original)).toEqual({});
});
test('only edited fields reach the website API with canonical names and types', () => {
  const edited = {
    ...original,
    num_brothers: '0',
    pref_age_min: '24',
    pref_age_max: '32',
    hobbies: 'Reading, Music',
    about: 'Hello',
  };
  expect(websiteProfileChanges(original, edited)).toEqual({
    num_brothers: 0,
    pref_age_min: 24,
    pref_age_max: 32,
    hobbies: ['Reading', 'Music'],
    about: 'Hello',
  });
});
test('unknown and unsupported edits cannot enter the save payload', () => {
  expect(
    websiteProfileChanges(original, {
      ...original,
      state: 'KA',
      lifestyle: 'Yes',
      email: 'new@example.com',
      horoscope: 'Aries',
    }),
  ).toEqual({});
});
test('explicit text and hobby clears survive', () => {
  const baseline = { ...original, hobbies: 'Reading', religion: 'Hindu' };
  expect(
    websiteProfileChanges(baseline, { ...baseline, hobbies: '', religion: '' }),
  ).toEqual({ hobbies: [], religion: '' });
});
test('website values survive mapping and retain zero sibling counts', () => {
  const profile = mapProfile({
    id: 'p',
    first_name: 'Test',
    last_name: 'Member',
    work_location: 'Pune',
    num_brothers: 0,
    pref_age_min: 24,
    education_detail: 'Computer science',
    date_of_birth: '1995-06-15',
  } as any);
  expect(websiteProfileValues(profile)).toMatchObject({
    first_name: 'Test',
    last_name: 'Member',
    num_brothers: '0',
    pref_age_min: '24',
    education_detail: 'Computer science',
    date_of_birth: '1995-06-15',
  });
});
test.each(['-1', '1.5', 'abc'])('rejects invalid sibling count %s', value => {
  expect(() =>
    websiteProfileChanges(original, { ...original, num_brothers: value }),
  ).toThrow('brothers');
});
test('rejects reversed and out of range partner ages', () => {
  expect(() =>
    websiteProfileChanges(original, {
      ...original,
      pref_age_min: '35',
      pref_age_max: '25',
    }),
  ).toThrow('Minimum');
  expect(() =>
    websiteProfileChanges(original, { ...original, pref_age_min: '17' }),
  ).toThrow('between 18 and 100');
});
test('validates date shape and calendar dates', () => {
  expect(() =>
    websiteProfileChanges(original, {
      ...original,
      date_of_birth: '1995-02-30',
    }),
  ).toThrow('YYYY-MM-DD');
  expect(
    websiteProfileChanges(original, {
      ...original,
      date_of_birth: '1995-06-15',
    }),
  ).toEqual({ date_of_birth: '1995-06-15' });
});
