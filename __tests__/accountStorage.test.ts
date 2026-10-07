import { accountStorageKey } from '../src/utils/storage';

test('account preference keys keep two members isolated and safely encoded', () => {
  expect(accountStorageKey('@mdp/mutedUsers', 'member/a')).toBe(
    '@mdp/mutedUsers:member%2Fa',
  );
  expect(accountStorageKey('@mdp/mutedUsers', 'member-a')).not.toBe(
    accountStorageKey('@mdp/mutedUsers', 'member-a2'),
  );
});
