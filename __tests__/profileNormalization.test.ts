import { getProfileById, mapProfile, updateMyProfile } from '../src/api/profileService';
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

test('profile edits use website field names and preserve explicit clears', async () => {
  jest.clearAllMocks();
  (patch as jest.Mock).mockResolvedValue({ success: true });
  (get as jest.Mock).mockResolvedValue({ user: { id: 'profile', state: '', religion: '' } });
  await updateMyProfile({ city: '', profession: 'Engineer', education: 'Degree', state: '', religion: '' });
  expect(patch).toHaveBeenCalledTimes(1);
  expect(patch).toHaveBeenCalledWith('/member-auth/me/', {
    work_location: '', occupation: 'Engineer', highest_education: 'Degree', state: '', religion: '',
  });
});

test('rejected state never becomes a successful save by dropping the field', async () => {
  jest.clearAllMocks();
  (patch as jest.Mock).mockRejectedValue(new Error('Field "state": This field name is not supported.'));
  await expect(updateMyProfile({ state: 'Maharashtra', religion: 'Hindu' })).rejects.toThrow('state');
  expect(patch).toHaveBeenCalledTimes(1);
  expect(get).not.toHaveBeenCalled();
});

test.each(['state', 'religion'] as const)('save detects when the server fails to persist %s', async field => {
  jest.clearAllMocks();
  (patch as jest.Mock).mockResolvedValue({ success: true });
  (get as jest.Mock).mockResolvedValue({ user: { id: 'profile' } });
  await expect(updateMyProfile({ [field]: 'Updated value' })).rejects.toThrow(`Your ${field} was not saved`);
});

test('state and religion are read back from the website after saving', async () => {
  jest.clearAllMocks();
  (patch as jest.Mock).mockResolvedValue({ success: true });
  (get as jest.Mock).mockResolvedValue({ user: { id: 'profile', state: 'Maharashtra', religion: 'Hindu' } });
  await expect(updateMyProfile({ state: 'Maharashtra', religion: 'Hindu' }))
    .resolves.toMatchObject({ state: 'Maharashtra', religion: 'Hindu' });
});


test.each([
  { id: 'member', name: 'Member', primary_photo: '/media/member.jpg' },
  { profile: { id: 'member', name: 'Member', primary_photo: '/media/member.jpg' } },
  { data: { profile: { id: 'member', name: 'Member', primary_photo: '/media/member.jpg' } } },
  { member: { id: 'member', name: 'Member', primary_photo: '/media/member.jpg' } },
])('profile details normalize supported response envelopes: %j', async response => {
  (get as jest.Mock).mockResolvedValue(response);
  await expect(getProfileById('member')).resolves.toMatchObject({
    id: 'member', name: 'Member', photo: 'https://mydearpartner.in/media/member.jpg',
  });
});

test.each([null, {}, { profile: {} }, { id: 'member' }])(
  'invalid detail responses reject rather than returning an empty profile: %j', async response => {
    (get as jest.Mock).mockResolvedValue(response);
    await expect(getProfileById('member')).rejects.toThrow('Could not load this profile');
  },
);
