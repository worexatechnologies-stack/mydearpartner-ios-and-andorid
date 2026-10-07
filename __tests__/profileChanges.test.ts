import { getProfileChanges } from '../src/utils/profileChanges';

test('saving a city edit omits unchanged and absent optional fields', () => {
  expect(getProfileChanges({ city: 'Chennai', name: 'Member' }, {
    city: 'Bengaluru', name: 'Member', horoscope: '', prompts: [], company: '',
  })).toEqual({ city: 'Bengaluru' });
});

test('clearing saved text and removing all prompts are persisted', () => {
  expect(getProfileChanges({
    company: 'Company', prompts: [{ question: 'Q', answer: 'A' }],
  }, { company: '', prompts: [] })).toEqual({ company: '', prompts: [] });
});

test('unchanged form needs no update request', () => {
  expect(getProfileChanges({ name: 'Member', prompts: [{ question: 'Q', answer: 'A' }] }, {
    name: 'Member', prompts: [{ question: 'Q', answer: 'A' }],
  })).toEqual({});
});
