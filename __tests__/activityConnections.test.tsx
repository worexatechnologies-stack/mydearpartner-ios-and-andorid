import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, FlatList, Text, TouchableOpacity, View } from 'react-native';
import InterestsScreen from '../src/screens/main/InterestsScreen';
import AnimatedButton from '../src/components/AnimatedButton';

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

jest.mock('@react-navigation/bottom-tabs', () => ({
  ...jest.requireActual('@react-navigation/bottom-tabs'),
  useBottomTabBarHeight: () => 72,
}));

jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }) }));

const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockChat = jest.fn().mockResolvedValue({ id: 'chat-1' });
const mockNavigate = jest.fn();
const mockProfile = {
  id: 'profile-1',
  name: 'Partner',
  age: 25,
  city: 'Chennai',
};
jest.mock('../src/context/AppDataContext', () => ({
  useAppData: () => ({
    receivedInterests: [
      {
        id: 'received',
        fromUserId: 'partner',
        status: 'accepted',
        senderProfile: mockProfile,
      },
      { id: 'pending', fromUserId: 'pending-user', status: 'pending' },
    ],
    sentInterests: [
      {
        id: 'sent',
        toUserId: 'partner',
        status: 'accepted',
        receiverProfile: mockProfile,
      },
      {
        id: 'other',
        toUserId: 'other-user',
        status: 'accepted',
        receiverProfile: { ...mockProfile, id: 'profile-2' },
      },
    ],
    shortlistedProfiles: [],
    getProfileById: () => undefined,
    isShortlisted: () => false,
    interestStatusFor: () => undefined,
    refreshInterests: jest.fn(),
    getOrCreateChatWith: mockChat,
    cancelInterest: mockCancel,
  }),
}));
jest.mock('../src/utils/planAllowance', () => ({
  usePlanAllowance: () => ({ isPremium: true, interestsRemaining: 10, interestsLimit: 10 }),
}));
jest.mock('../src/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useFocusEffect: jest.fn(),
}));
jest.mock(
  '../src/components/ScreenContainer',
  () => require('react-native').View,
);
jest.mock('../src/components/AuthImage', () => require('react-native').View);

test('Connected deduplicates accepted people from both directions and opens their chat', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(
      <InterestsScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{} as any}
      />,
    );
  });
  const connected = tree.root
    .findAllByType(AnimatedButton)
    .find(button =>
      button
        .findAllByType(Text)
        .some(text =>
          JSON.stringify(text.props.children).includes('Connected'),
        ),
    )!;
  await act(async () => connected.props.onPress());
  const viewport = tree.root
    .findAllByType(View)
    .find(view => view.props.onLayout)!;
  await act(async () =>
    viewport.props.onLayout({ nativeEvent: { layout: { height: 500 } } }),
  );
  const list = tree.root.findByType(FlatList);
  expect(list.props.pagingEnabled).toBe(true);
  expect(list.props.snapToInterval).toBe(500);
  expect(list.props.getItemLayout(null, 1)).toEqual({
    length: 500,
    offset: 500,
    index: 1,
  });
  expect(list.props.data.map((item: any) => item.otherUserId)).toEqual([
    'partner',
    'other-user',
  ]);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const unconnectButtons = tree.root.findAllByType(TouchableOpacity)
    .filter(button => button.props.accessibilityLabel === 'Unconnect');
  expect(unconnectButtons).toHaveLength(2);
  for (const [index, button] of unconnectButtons.entries()) {
    await act(async () => button.props.onPress());
    const actions = alert.mock.calls[index][2]!;
    await act(async () => { await actions.find(action => action.text === 'Unconnect')!.onPress!(); });
  }
  expect(mockCancel).toHaveBeenCalledWith('received');
  expect(mockCancel).toHaveBeenCalledWith('other');
  alert.mockRestore();
  const chatLabel = tree.root
    .findAllByType(Text)
    .find(text => text.props.children === 'Chat with Match')!;
  let chatButton = chatLabel.parent!;
  while (chatButton.type !== TouchableOpacity) chatButton = chatButton.parent!;
  await act(async () => {
    await chatButton.props.onPress();
  });
  expect(mockChat).toHaveBeenCalledWith('profile-1');
  expect(mockNavigate).toHaveBeenCalledWith('Chat', {
    chatId: 'chat-1',
    otherProfileId: 'profile-1',
  });
  await act(async () => tree.unmount());
});
