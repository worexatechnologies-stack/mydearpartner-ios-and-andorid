import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileDetailScreen from '../src/screens/ProfileDetailScreen';
import ScreenContainer from '../src/components/ScreenContainer';
import AnimatedButton from '../src/components/AnimatedButton';

let mockDimensions = { width: 320, height: 568, scale: 1, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('../src/components/AuthImage', () => 'AuthImage');
jest.mock('../src/components/SafetyCenter', () => () => null);
jest.mock('../src/components/CompatibilityBreakdownModal', () => () => null);
jest.mock('../src/components/GeminiHoroscopeModal', () => () => null);
jest.mock('../src/api/profileService', () => ({ getProfileById: jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
jest.mock('../src/context/AppDataContext', () => {
  const profile = {
    id: 'profile', userId: 'other', name: 'A very long profile name for a narrow phone',
    age: 24, city: 'Harohalli', state: 'Karnataka', photo: 'https://example.com/photo.jpg',
    education: 'Master of Business Administration', profession: 'Software Engineer',
    photos: ['https://example.com/photo.jpg'],
  };
  return { useAppData: () => ({
    getProfileById: () => profile,
    getInterestRelationship: () => ({ status: 'none', isMutual: false }),
    interestStatusFor: () => undefined,
    isBlockedByMe: () => false,
  }) };
});
jest.mock('../src/utils/planAllowance', () => {
  const allowance = {
    recordView: jest.fn(), interestsRemaining: 999, interestsLimit: 999,
    viewsRemaining: 998, viewsLimit: 999,
    planConfig: { name: 'Gold VIP', badge: 'GOLD VIP', accentColor: '#F59E0B' },
  };
  return { usePlanAllowance: () => allowance };
});

const props: any = { route: { params: { profileId: 'profile' } }, navigation: { goBack: jest.fn() } };
const styleOf = (node: any) => StyleSheet.flatten(node.props.style);

it.each([
  [320, 568, 1], [360, 800, 1], [430, 932, 1],
  [768, 1024, 1], [1024, 768, 1], [320, 568, 2],
])('fits the profile to a %s × %s viewport with font scale %s', async (width, height, fontScale) => {
  mockDimensions = { width, height, fontScale, scale: 1 };
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<ProfileDetailScreen {...props} />); });
  const root = tree.root;
  const screen = root.findByType(ScreenContainer);
  const availableWidth = Math.min(width, 640);
  await act(async () => screen.props.onLayout({ nativeEvent: { layout: { width: availableWidth } } }));
  const photo = root.findAllByType(View).find(node => styleOf(node)?.height && styleOf(node)?.overflow === 'hidden' && styleOf(node)?.width === availableWidth - 32);
  expect(photo).toBeDefined();
  expect(styleOf(photo).width + 32).toBeLessThanOrEqual(availableWidth);
  const verticalScroll = root.findAllByType(ScrollView).find(node => !node.props.horizontal)!;
  expect(styleOf(verticalScroll).marginTop).toBeUndefined();
  expect(root.findByType(SafeAreaView).props.edges).toEqual(['top', 'bottom', 'left', 'right']);
  const banner = root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === 'View compatibility breakdown')!;
  expect(styleOf(banner).flexDirection).toBe(availableWidth < 360 || fontScale > 1.2 ? 'column' : 'row');
  const actions = root.findAllByType(AnimatedButton);
  expect(actions).toHaveLength(2);
  expect(styleOf(actions[1]).height).toBeUndefined();
  expect(styleOf(actions[1]).minHeight).toBe(48);
  await act(async () => tree.unmount());
});

it('recalculates carousel width after a split-screen resize', async () => {
  mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<ProfileDetailScreen {...props} />); });
  await act(async () => tree.root.findByType(ScreenContainer).props.onLayout({ nativeEvent: { layout: { width: 300 } } }));
  expect(tree.root.findAllByType(View).some(node => styleOf(node)?.width === 268 && styleOf(node)?.overflow === 'hidden')).toBe(true);
  await act(async () => tree.unmount());
});

it('preserves full photos and gives each carousel page the explicit measured height', async () => {
  mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => { tree = Renderer.create(<ProfileDetailScreen {...props} />); });
  const image = tree.root.findAllByType('AuthImage' as any).find(node => node.props.showLoading)!;
  expect(image.props.resizeMode).toBe('contain');
  await act(async () => image.props.onLoad({ nativeEvent: { source: { width: 600, height: 1800 } } }));
  const updated = tree.root.findAllByType('AuthImage' as any).find(node => node.props.showLoading)!;
  expect(styleOf(updated).height).toBeLessThanOrEqual(768 * 0.6);
  expect(styleOf(updated.parent).height).toBe(styleOf(updated).height);
  const carousel = tree.root.findAllByType(ScrollView).find(node => node.props.pagingEnabled)!;
  expect(StyleSheet.flatten(carousel.props.contentContainerStyle).height).toBe(styleOf(updated).height);
  await act(async () => tree.unmount());
});
