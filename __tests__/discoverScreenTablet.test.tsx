import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Animated, View, StyleSheet } from 'react-native';
import DiscoverScreen from '../src/screens/main/DiscoverScreen';

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { profile: { city: 'Bengaluru' } } }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  ...jest.requireActual('@react-navigation/bottom-tabs'),
  useBottomTabBarHeight: () => 88,
}));

// Mock Animated timing to avoid native driver timers in test runtime
jest.spyOn(Animated, 'timing').mockImplementation(() => ({
  start: (cb?: any) => {
    if (cb) cb({ finished: true });
  },
  stop: () => {},
  reset: () => {},
}));

const mockRelationships: Record<string, string> = {};

// Mock contexts and hooks
jest.mock('../src/context/AppDataContext', () => ({
  useAppData: () => ({
    discoverProfiles: [
      {
        id: 'prof_1',
        userId: 'usr_1',
        name: 'Priya Sharma',
        age: 26,
        city: 'Bangalore',
        state: 'Karnataka',
        religion: 'Hindu',
        profession: 'Software Engineer',
        education: 'B.Tech',
        photo: 'https://example.com/photo1.jpg',
        isVerified: true,
        isOnline: true,
        height: '5\'4"',
        maritalStatus: 'Never Married',
        motherTongue: 'Hindi',
      },
      {
        id: 'prof_2',
        userId: 'usr_2',
        name: 'Ananya Verma',
        age: 27,
        city: 'Mumbai',
        state: 'Maharashtra',
        religion: 'Hindu',
        profession: 'Architect',
        education: 'B.Arch',
        photo: 'https://example.com/photo2.jpg',
        isVerified: false,
        isOnline: false,
        height: '5\'6"',
        maritalStatus: 'Never Married',
        motherTongue: 'Marathi',
      },
    ],
    sendInterest: jest.fn(),
    cancelInterest: jest.fn(),
    toggleShortlist: jest.fn(),
    isShortlisted: jest.fn().mockReturnValue(false),
    receivedInterests: [],
    interestStatusFor: jest.fn().mockReturnValue(undefined),
    getInterestRelationship: jest
      .fn()
      .mockImplementation((id: string) => ({ status: mockRelationships[id] ?? 'none', isMutual: false })),
    respondToInterest: jest.fn(),
    getOrCreateChatWith: jest.fn(),
    isLoadingProfiles: false,
    getProfileById: jest.fn(),
  }),
}));

jest.mock('../src/utils/planAllowance', () => ({
  usePlanAllowance: () => ({
    interestsRemaining: 5,
    interestsLimit: 10,
    isInterestsUnlimited: false,
    isInterestsExhausted: false,
    viewsRemaining: 20,
    viewsLimit: 50,
    isViewsUnlimited: false,
    isViewsExhausted: false,
    planConfig: {
      name: 'Gold Plan',
      badge: 'GOLD',
      accentColor: '#F59E0B',
    },
    refreshUsage: jest.fn(),
    markDailyInterestsExhausted: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...actual,
    useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
  };
});

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useFocusEffect: (cb: () => void) => cb(),
  };
});

// Mock react-native useWindowDimensions
let mockWindowDimensions = { width: 390, height: 844 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => mockWindowDimensions,
}));

describe('DiscoverScreen Tablet & Responsive Layout', () => {
  const mockNavigation: any = {
    navigate: jest.fn(),
    goBack: jest.fn(),
  };
  const mockRoute: any = { key: 'discover', name: 'Discover' };

  it('renders correctly on phone layout (width 390px, 1 column)', async () => {
    mockWindowDimensions = { width: 390, height: 844 };

    let tree: any;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DiscoverScreen navigation={mockNavigation} route={mockRoute} />,
      );
    });

    const root = tree.root;
    const flatList = root.findByType(FlatList);
    // Discover should be a focused 1-column showcase feed
    expect(flatList.props.numColumns).toBeUndefined();
    expect(flatList.props.columnWrapperStyle).toBeUndefined();
  });

  it('sizes each scroll page to the viewport and keeps navigation outside it', async () => {
    let tree: any;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DiscoverScreen navigation={mockNavigation} route={mockRoute} />,
      );
    });
    const viewport = tree.root
      .findAllByType(View)
      .find((view: any) => view.props.onLayout);
    expect(StyleSheet.flatten(viewport.props.style).marginBottom).toBe(130);
    await ReactTestRenderer.act(() => {
      viewport.props.onLayout({ nativeEvent: { layout: { height: 540 } } });
    });
    const list = tree.root.findByType(FlatList);
    expect(list.props.pagingEnabled).toBe(true);
    expect(list.props.disableIntervalMomentum).toBe(true);
    expect(list.props.snapToInterval).toBe(540);
    expect(list.props.ListHeaderComponent).toBeUndefined();
    expect(list.props.getItemLayout(null, 1)).toEqual({
      length: 540,
      offset: 540,
      index: 1,
    });
  });

  it('opens the working search filter sheet from Discover', async () => {
    let tree: any;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <DiscoverScreen navigation={mockNavigation} route={mockRoute} />,
      );
    });
    const button = tree.root
      .findAllByProps({ accessibilityLabel: 'Filter profiles' })
      .find((node: any) => typeof node.props.onPress === 'function');
    await ReactTestRenderer.act(async () => button!.props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Search', {
      openFilters: true,
    });
    await ReactTestRenderer.act(async () => tree.unmount());
  });

  it('renders correctly on tablet layout (width 768px, focused centered spotlight card)', async () => {
    mockWindowDimensions = { width: 768, height: 1024 };

    let tree: any;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DiscoverScreen navigation={mockNavigation} route={mockRoute} />,
      );
    });

    const root = tree.root;
    const flatList = root.findByType(FlatList);
    // Distinct from Search grid: Discover stays an immersive 1-column showcase
    expect(flatList.props.numColumns).toBeUndefined();
    expect(flatList.props.columnWrapperStyle).toBeUndefined();
  });

  it('renders correctly on wide landscape tablet (width 1280px)', async () => {
    mockWindowDimensions = { width: 1280, height: 800 };

    let tree: any;
    await ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <DiscoverScreen navigation={mockNavigation} route={mockRoute} />,
      );
    });

    const root = tree.root;
    const flatList = root.findByType(FlatList);
    expect(flatList.props.numColumns).toBeUndefined();
    expect(flatList.props.columnWrapperStyle).toBeUndefined();
  });
});

test.each(['none', 'declined', 'withdrawn', 'cancelled'])('Discover displays an unconnected profile with %s history', async status => {
  mockRelationships.prof_1 = status;
  mockRelationships.prof_2 = 'accepted';
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<DiscoverScreen navigation={{ navigate: jest.fn() } as any} route={{} as any} />);
  });
  expect(tree.root.findByType(FlatList).props.data.map((item: any) => item.id)).toEqual(['prof_1']);
  await ReactTestRenderer.act(async () => tree.unmount());
  delete mockRelationships.prof_1;
  delete mockRelationships.prof_2;
});
