import { sameProfileCity } from '../src/utils/profileLocation';
import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Animated, StyleSheet } from 'react-native';
import { profilePageSize } from '../src/hooks/useProfilePager';
import OfflineBanner from '../src/components/OfflineBanner';
import { colors } from '../src/theme/theme';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../src/hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isConnected: false }),
}));
jest.mock('../src/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

test.each([
  ['small phone', 340, 1, 340],
  ['standard phone', 540, 1, 540],
  ['large phone', 660, 1, 660],
  ['landscape', 180, 1, 300],
  ['large accessibility text', 380, 2, 600],
  ['tablet', 750, 1, 750],
])(
  '%s preserves enough height for readable profile actions',
  (_device, viewport, fontScale, expected) => {
    expect(profilePageSize(viewport, fontScale)).toBe(expected);
  },
);

test('offline notice reserves the Dynamic Island inset and remains accessible', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(<OfflineBanner />);
  });
  const banner = tree.root.findByType(Animated.View);
  expect(StyleSheet.flatten(banner.props.style).paddingTop).toBe(69);
  expect(banner.props.accessibilityElementsHidden).toBe(false);
  expect(banner.props.accessibilityLiveRegion).toBe('assertive');
  await act(async () => tree.unmount());
});

function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(channel =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
test('action buttons and secondary labels meet 4.5:1 text contrast', () => {
  expect(1.05 / (luminance(colors.action) + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(1.05 / (luminance(colors.actionDark) + 0.05)).toBeGreaterThanOrEqual(4.5);
  expect(
    (luminance(colors.background) + 0.05) /
      (luminance(colors.textLight) + 0.05),
  ).toBeGreaterThanOrEqual(4.5);
});

test('Nearby matches normalized cities and excludes missing or different locations', () => {
  expect(sameProfileCity('Bengaluru', ' Bangalore ')).toBe(true);
  expect(sameProfileCity('Bangalore', 'Mumbai')).toBe(false);
  expect(sameProfileCity('Bangalore', '')).toBe(false);
  expect(sameProfileCity(undefined, undefined)).toBe(false);
});
