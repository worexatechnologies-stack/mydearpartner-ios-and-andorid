import { formatRelativeTime } from '../src/utils/relativeTime';

const now = Date.UTC(2026, 8, 30, 12);
test.each([
  [0, 'Just now'],
  [1, '1m ago'],
  [59, '59m ago'],
  [60, '1h ago'],
  [23 * 60, '23h ago'],
  [24 * 60, 'Yesterday'],
  [47 * 60, 'Yesterday'],
  [48 * 60, '2d ago'],
  [6 * 24 * 60, '6d ago'],
])('formats elapsed %i minutes as %s', (minutes, expected) => {
  expect(formatRelativeTime(now - minutes * 60000, now)).toBe(expected);
});

test('shows a date after a week and handles missing timestamps', () => {
  const old = now - 7 * 86400000;
  expect(formatRelativeTime(old, now)).toBe(
    new Date(old).toLocaleDateString([], { month: 'short', day: 'numeric' }),
  );
  expect(formatRelativeTime(undefined, now)).toBe('Just now');
});
