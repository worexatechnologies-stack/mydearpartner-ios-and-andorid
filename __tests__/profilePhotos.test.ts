import { get, upload, del } from '../src/api/apiClient';
import { mapProfile, getMyPhotos, uploadPhoto, deletePhoto } from '../src/api/profileService';
import { resolveProfilePhotoUrl } from '../src/utils/profilePhotos';
jest.mock('../src/api/apiClient', () => ({ get: jest.fn(), upload: jest.fn(), del: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
const photo = { id: 'photo-id', image_url: '/api/profile-photos/photo-id/image/?v=123', is_primary: true };
const uri = 'https://mydearpartner.in/api/profile-photos/photo-id/image/?v=123';

test('discovery primary_photo supplies a secure image and deletion ID', () => {
  const mapped = mapProfile({ id: 'member', primary_photo: photo } as any);
  expect(mapped.photo).toBe(uri);
  expect(mapped.photoIds?.[uri]).toBe('photo-id');
});
test('photo URLs preserve versions and resolve protocol-relative URLs correctly', () => {
  expect(resolveProfilePhotoUrl('//mydearpartner.in/api/photo/?v=1')).toBe('https://mydearpartner.in/api/photo/?v=1');
  expect(resolveProfilePhotoUrl('javascript:alert(1)')).toBe('');
});
test('owner gallery supplies canonical IDs even when the profile only has URL strings', async () => {
  (get as jest.Mock).mockResolvedValue({ photos: [photo], max_photos: 0 });
  await expect(getMyPhotos()).resolves.toEqual({ photos: [{ id: 'photo-id', uri, isPrimary: true }], maxPhotos: 0 });
  expect(get).toHaveBeenCalledWith('/profile-photos/mine/');
});
test('uploads use the photo collection and retain the returned photo ID', async () => {
  (upload as jest.Mock).mockResolvedValue(photo);
  await expect(uploadPhoto('file:///photo.jpg', 'photo.jpg', 'image/jpeg')).resolves.toEqual({ id: 'photo-id', uri, isPrimary: true });
  expect(upload).toHaveBeenCalledWith('/profile-photos/', expect.any(FormData), 'POST');
});
test('delete uses the actual photo route and propagates errors', async () => {
  (del as jest.Mock).mockRejectedValue(new Error('Not allowed'));
  await expect(deletePhoto('photo-id')).rejects.toThrow('Not allowed');
  expect(del).toHaveBeenCalledWith('/profile-photos/photo-id/');
});
test('incomplete gallery records cannot silently erase the displayed gallery', async () => {
  (get as jest.Mock).mockResolvedValue({ photos: [{ image_url: '/photo.jpg' }] });
  await expect(getMyPhotos()).rejects.toThrow('incomplete photo records');
});

test('iPhone HEIC and HEIF photos are sanitized to JPEG format for universal compatibility', async () => {
  const { sanitizePhotoUpload } = require('../src/utils/profilePhotos');
  expect(sanitizePhotoUpload('IMG_4821.HEIC', 'image/heic')).toEqual({
    fileName: 'IMG_4821.jpg',
    mimeType: 'image/jpeg',
  });
  expect(sanitizePhotoUpload('portrait.heif', 'image/heif')).toEqual({
    fileName: 'portrait.jpg',
    mimeType: 'image/jpeg',
  });
  expect(sanitizePhotoUpload('photo-no-ext', 'image/jpeg')).toEqual({
    fileName: 'photo-no-ext.jpg',
    mimeType: 'image/jpeg',
  });

  (upload as jest.Mock).mockResolvedValue(photo);
  await expect(uploadPhoto('file:///IMG_1001.HEIC', 'IMG_1001.HEIC', 'image/heic')).resolves.toEqual({
    id: 'photo-id',
    uri,
    isPrimary: true,
  });
  expect(upload).toHaveBeenCalledWith(
    '/profile-photos/',
    expect.any(FormData),
    'POST',
  );
});

