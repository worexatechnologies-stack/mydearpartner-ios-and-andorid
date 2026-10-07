import { mapProfile, updateMyProfile } from '../src/api/profileService';
import { get, patch } from '../src/api/apiClient';
jest.mock('../src/api/apiClient', () => ({ patch: jest.fn(), get: jest.fn() }));
test('partial profiles have safe strings and normalized gender', () => {
  const profile = mapProfile({
    id: 'p',
    gender: 'Female',
    age: '26',
    active_membership: {
      limits: { contact_unlocks: 7, daily_interests_limit: 50 },
    },
  } as any);
  expect(profile).toMatchObject({
    profession: '',
    religion: '',
    gender: 'female',
    age: 26,
    contactUnlocks: 7,
  });
});
test('malformed profile is rejected instead of becoming a successful empty save', () => {
  expect(mapProfile(null as any).id).toBe('');
  expect(mapProfile({} as any).id).toBe('');
});
test('gallery photo IDs survive normalization for server-side removal', () => {
  const profile = mapProfile({ id: 'p', photos: [{ id: 42, image_url: '/media/photo.jpg' }] } as any);
  expect(profile.photo).toBe('https://mydearpartner.in/media/photo.jpg');
  expect(profile.photoIds?.[profile.photo]).toBe('42');
});
test('profile save accepts the same user envelope as profile loading', async () => {
  (patch as jest.Mock).mockResolvedValue({
    user: { id: 'profile', name: 'Member' },
  });
  (get as jest.Mock).mockResolvedValue({ user: { id: 'profile', name: 'Member' } });
  await expect(
    updateMyProfile({ first_name: 'Member' }),
  ).resolves.toMatchObject({ id: 'profile', name: 'Member' });
});

test('missing personal and verification attributes are never fabricated', () => {
  const profile = mapProfile({ id: 'member' } as any);
  expect(profile.managedBy).toBeUndefined();
  expect(profile.lifestyle).toBeUndefined();
  expect(profile.verificationBadges).toEqual([]);
});

test('explicit profile attributes survive mapping without invented badges', () => {
  const profile = mapProfile({ id: 'member', managed_by: 'Parent', verification_badges: ['id', 'fake'], lifestyle: { smoking: 'No' } } as any);
  expect(profile.managedBy).toBe('Parent');
  expect(profile.verificationBadges).toEqual(['id']);
  expect(profile.lifestyle?.smoking).toBe('No');
  expect(profile.lifestyle?.diet).toBeUndefined();
});


test('unexpected scalar field types cannot reach text rendering or string operations', () => {
  const profile = mapProfile({ id: 'profile', name: { bad: true }, city: 123, religion: [], occupation: {}, highest_education: 42, height: {}, about: {}, hobbies: { bad: true }, age: 'Infinity' } as any);
  expect(profile).toMatchObject({ id: 'profile', name: '', city: '', religion: '', profession: '', education: '', height: '', about: '', interests: [], age: 0 });
});
