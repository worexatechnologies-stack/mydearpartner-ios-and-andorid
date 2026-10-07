import { authenticatedImageSource } from '../src/utils/imageSource';

test('authenticates first-party media and preserves source options', () => {
  expect(
    authenticatedImageSource(
      {
        uri: 'https://mydearpartner.in/media/avatar.jpg',
        headers: { Accept: 'image/*' },
        cache: 'reload',
      },
      'test-token',
    ),
  ).toEqual({
    uri: 'https://mydearpartner.in/media/avatar.jpg',
    headers: { Accept: 'image/*', Authorization: 'Bearer test-token' },
    cache: 'reload',
  });
});
test.each([
  'https://example.com/photo.jpg',
  'https://mydearpartner.in.evil.example/photo',
  'https://mydearpartner.in@evil.example/photo',
  'http://mydearpartner.in/media/photo',
  'file:///photo.jpg',
  'invalid',
])('does not disclose credentials to %s', uri => {
  expect(authenticatedImageSource({ uri }, 'test-token')).toEqual({ uri });
});
test('supports anonymous image loading', () => {
  expect(
    authenticatedImageSource({ uri: 'https://mydearpartner.in/media/photo' }),
  ).toEqual({ uri: 'https://mydearpartner.in/media/photo' });
});
