import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { FlatList } from 'react-native';
import ChatsListScreen from '../src/screens/main/ChatsListScreen';
import ChatScreen from '../src/screens/ChatScreen';
import AnimatedButton from '../src/components/AnimatedButton';
let mockFocused = true;
let mockDimensions = { width: 1024, height: 768, fontScale: 1, scale: 1 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({ default: () => mockDimensions }));
jest.mock('../src/screens/ChatScreen', () => ({ __esModule: true, default: () => null }));
jest.mock('@react-navigation/native', () => ({ ...jest.requireActual('@react-navigation/native'), useIsFocused: () => mockFocused, useFocusEffect: () => {} }));
jest.mock('@react-navigation/bottom-tabs', () => ({ ...jest.requireActual('@react-navigation/bottom-tabs'), useBottomTabBarHeight: () => 72 }));
jest.mock('react-native-safe-area-context', () => ({ ...jest.requireActual('react-native-safe-area-context'), useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/components/AuthImage', () => () => null);
jest.mock('../src/services/PresenceService', () => ({ subscribeToPresence: () => jest.fn() }));
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'me', profile: { id: 'me' } } }) }));
jest.mock('../src/utils/planAllowance', () => ({ usePlanAllowance: () => ({ isPremium: true }) }));
jest.mock('../src/context/AppDataContext', () => {
  const profile = { id: 'alex', userId: 'member-alex', name: 'Alex', photo: '', city: 'Bengaluru' };
  const value = {
    chats: [{ id: 'conversation', participantIds: ['me', 'member-alex'], otherProfile: profile, lastMessage: 'Hello', lastMessageAt: 1 }],
    getProfileById: () => profile, getOtherParticipantId: () => 'member-alex', sentInterests: [], receivedInterests: [],
    refreshChats: jest.fn().mockResolvedValue(undefined), isUserMuted: () => false, isBlockedByMe: () => false,
  };
  return { useAppData: () => value };
});
let tree: Renderer.ReactTestRenderer;
const navigation = { navigate: jest.fn() };
const props: any = { navigation, route: { key: 'Chats', name: 'Chats' } };
const openChat = () => tree.root.findAllByType(AnimatedButton).find(node => node.props.accessibilityLabel?.startsWith('Alex'))!.props.onPress();
afterEach(async () => { await act(async () => tree?.unmount()); jest.clearAllMocks(); });
test('tablet selection opens a second pane and rotation retains the selected conversation', async () => {
  mockDimensions = { width: 1024, height: 768, fontScale: 1, scale: 1 };
  await act(async () => { tree = Renderer.create(<ChatsListScreen {...props} />); });
  await act(async () => openChat());
  expect(navigation.navigate).not.toHaveBeenCalled();
  expect(tree.root.findByType(ChatScreen).props.route.params.chatId).toBe('conversation');
  expect(tree.root.findByType(ChatScreen).props.embedded).toBe(true);
  expect(tree.root.findAllByType(FlatList)).toHaveLength(1);
  mockFocused = false;
  await act(async () => { tree.update(<ChatsListScreen {...props} />); });
  expect(tree.root.findAllByType(ChatScreen)).toHaveLength(0);
  mockFocused = true;
  await act(async () => { tree.update(<ChatsListScreen {...props} />); });
  expect(tree.root.findByType(ChatScreen).props.route.params.chatId).toBe('conversation');
  mockDimensions = { width: 768, height: 1024, fontScale: 1, scale: 1 };
  await act(async () => { tree.update(<ChatsListScreen {...props} />); });
  expect(tree.root.findByType(ChatScreen).props.route.params.chatId).toBe('conversation');
  expect(tree.root.findAllByType(FlatList)).toHaveLength(0);
  await act(async () => tree.root.findByType(ChatScreen).props.navigation.goBack());
  expect(tree.root.findAllByType(ChatScreen)).toHaveLength(0);
  expect(tree.root.findAllByType(FlatList)).toHaveLength(1);
});
test('phone selection retains native chat navigation', async () => {
  mockDimensions = { width: 390, height: 844, fontScale: 1, scale: 1 };
  await act(async () => { tree = Renderer.create(<ChatsListScreen {...props} />); });
  await act(async () => openChat());
  expect(navigation.navigate).toHaveBeenCalledWith('Chat', expect.objectContaining({ chatId: 'conversation' }));
  expect(tree.root.findAllByType(ChatScreen)).toHaveLength(0);
});
