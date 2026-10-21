import { profilePhotoLayout } from '../src/utils/profilePhotoLayout';
test.each([[320, 568], [640, 1024], [640, 768], [300, 360]])('bounds portrait photos at viewport %s by %s', (width, height) => {
  const frame = profilePhotoLayout(width, height, 600, 1800);
  expect(frame.width).toBe(width - 32);
  expect(frame.height).toBeLessThanOrEqual(Math.max(180, Math.min(640, height * 0.6)));
  expect(frame.height).toBeGreaterThan(0);
});
test('landscape source determines natural height instead of a fixed screen fraction', () => {
  expect(profilePhotoLayout(640, 1024, 1600, 900)).toEqual({ width: 608, height: 342 });
});
test('invalid source sizes retain finite, positive layout', () => {
  const frame = profilePhotoLayout(320, 568, 0, Number.NaN);
  expect(Number.isFinite(frame.height)).toBe(true);
  expect(frame.height).toBeGreaterThan(0);
});
