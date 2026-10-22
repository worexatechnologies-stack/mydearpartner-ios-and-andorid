import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import ScreenContainer from '../src/components/ScreenContainer';
import EditProfileScreen from '../src/screens/EditProfileScreen';
import WelcomeScreen from '../src/screens/auth/WelcomeScreen';

let mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockDimensions,
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }),
}));
jest.mock('../src/components/AuthImage', () => 'AuthImage');
jest.mock('../src/components/AppButton', () => 'AppButton');
jest.mock('../src/api/profileService', () => ({
  getMyPhotos: jest.fn().mockResolvedValue({ photos: [], maxPhotos: 5 }),
  updateMyProfile: jest.fn().mockResolvedValue({ id: 'p' }),
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      profile: {
        id: 'p',
        name: 'Test Member',
        city: 'Bengaluru',
        religion: 'Hindu',
        interests: [],
        photos: [],
      },
    },
    updateProfile: jest.fn(),
    refreshCurrentUser: jest.fn(),
  }),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

describe('Tablet and Mobile UI Auto Adjust', () => {
  it('ScreenContainer applies tablet constraint (maxWidth: 640) on wide screens and preserves custom background', () => {
    mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
    let tree!: Renderer.ReactTestRenderer;
    act(() => {
      tree = Renderer.create(
        <ScreenContainer backgroundColor="#FAF8F7">
          <Text>Content</Text>
        </ScreenContainer>,
      );
    });
    const root = tree.root;
    const views = root.findAllByType(View);
    const constrainedView = views.find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s?.maxWidth === 640 && s?.alignSelf === 'center';
    });
    expect(constrainedView).toBeDefined();
    act(() => tree.unmount());
  });

  it('EditProfileScreen applies tablet-centered bounds (maxWidth: 680) on tablet viewport', async () => {
    mockDimensions = { width: 768, height: 1024, scale: 1, fontScale: 1 };
    let tree!: Renderer.ReactTestRenderer;
    await act(async () => {
      tree = Renderer.create(
        <EditProfileScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() } as any} route={{} as any} />,
      );
    });
    const root = tree.root;
    const views = root.findAllByType(View);
    const constrainedViews = views.filter(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s?.maxWidth === 680 && s?.alignSelf === 'center';
    });
    // Header, TabBarWrapper, and SaveButtonWrapper all have tablet constraint applied
    expect(constrainedViews.length).toBeGreaterThanOrEqual(3);
    await act(async () => tree.unmount());
  });

  it('EditProfileScreen uses compact padding on narrow phone screen (width < 360)', async () => {
    mockDimensions = { width: 320, height: 568, scale: 1, fontScale: 1 };
    let tree!: Renderer.ReactTestRenderer;
    await act(async () => {
      tree = Renderer.create(
        <EditProfileScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() } as any} route={{} as any} />,
      );
    });
    const root = tree.root;
    const scrollViews = root.findAllByType(ScrollView);
    const contentScroll = scrollViews.find(s => {
      const cs = StyleSheet.flatten(s.props.contentContainerStyle);
      return cs?.paddingHorizontal === 12;
    });
    expect(contentScroll).toBeDefined();
    await act(async () => tree.unmount());
  });

  it('WelcomeScreen constrains hero container height and centers content on tablet', async () => {
    mockDimensions = { width: 1024, height: 768, scale: 1, fontScale: 1 };
    let tree!: Renderer.ReactTestRenderer;
    await act(async () => {
      tree = Renderer.create(<WelcomeScreen />);
    });
    const root = tree.root;
    // Hero image container should be capped to at most 380px on wide viewports
    const heroContainer = root.findAllByType(View).find(v => {
      const s = StyleSheet.flatten(v.props.style);
      return s?.height === 380;
    });
    expect(heroContainer).toBeDefined();

    // Scroll content should be constrained to 540px
    const scroll = root.findByType(ScrollView);
    const contentStyle = StyleSheet.flatten(scroll.props.contentContainerStyle);
    expect(contentStyle.maxWidth).toBe(540);
    expect(contentStyle.alignSelf).toBe('center');

    await act(async () => tree.unmount());
  });
});
