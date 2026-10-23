import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import * as Native from 'react-native';
import ChatScreen from '../src/screens/ChatScreen';
import { useAppData } from '../src/context/AppDataContext';
import { blockService } from '../src/api/blockService';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('../src/context/AppDataContext', () => {
  const data = {
    getProfileById: () => ({ name: 'Partner', userId: 'other' }),
    getMessagesForChat: jest.fn(() => []),
    loadChatMessages: jest.fn().mockResolvedValue(undefined),
    loadOlderChatMessages: jest.fn().mockResolvedValue(undefined),
    getChatHistoryState: jest.fn(() => ({ next: null, loading: false })),
    connectToChat: jest.fn(), disconnectFromChat: jest.fn(),
    markChatAsRead: jest.fn(), isBlockedByMe: () => false,
    isUserMuted: () => false,
    sendMessage: jest.fn(),
  };
  return { useAppData: () => data };
});
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: { id: 'me', profile: { id: 'mine' } } }) }));
jest.mock('../src/api/blockService', () => ({ blockService: { checkIfBlockedBy: jest.fn().mockResolvedValue(false) } }));
jest.mock('../src/services/PresenceService', () => ({ subscribeToPresence: () => jest.fn() }));
jest.mock('../src/api/wsClient', () => ({ chatWsClient: { sendTyping: jest.fn() } }));
jest.mock('../src/components/SafetyCenter', () => () => null);
jest.mock('../src/components/AuthImage', () => () => null);
let mockIsPremium = true;
jest.mock('../src/utils/planAllowance', () => ({
  usePlanAllowance: () => ({ isPremium: mockIsPremium }),
}));

test.each([false, true])('a forbidden send disables chat only when blocking is confirmed: %s', async blocked => {
  const sendMessage = useAppData().sendMessage as jest.Mock;
  sendMessage.mockRejectedValueOnce({ status: 403, message: 'Messaging is not included in your plan.' });
  const check = blockService.checkIfBlockedBy as jest.Mock;
  check.mockResolvedValueOnce(false).mockResolvedValueOnce(blocked);
  const alert = jest.spyOn(Native.Alert, 'alert').mockImplementation(() => {});
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<ChatScreen navigation={{ setOptions: jest.fn() } as any} route={{ params: { chatId: 'chat', otherProfileId: 'other' } } as any} />);
    });
    act(() => tree.root.findByType(TextInput).props.onChangeText('Keep this draft'));
    await act(async () => { await tree.root.findAllByProps({ accessibilityLabel: 'Send message' })[0].props.onPress(); });
    expect(sendMessage).toHaveBeenCalledWith('chat', 'Keep this draft', 'other');
    expect(alert).toHaveBeenCalledWith('Couldn’t send message', 'Messaging is not included in your plan.');
    if (blocked) expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    else expect(tree.root.findByType(TextInput).props.value).toBe('Keep this draft');
  } finally {
    if (tree) await act(async () => tree.unmount());
    alert.mockRestore();
    sendMessage.mockClear();
  }
});

describe.each([
  ['android', 320, 568],
  ['android', 800, 360],
  ['ios', 375, 667],
  ['ios', 1024, 768],
] as const)('chat keyboard on %s at %sx%s', (os, width, height) => {
  it('keeps the draft and composer mounted while removing the home inset for the keyboard', async () => {
    const platform = jest.replaceProperty(Platform, 'OS', os);
    const dimensions = jest.spyOn(Native, 'useWindowDimensions').mockReturnValue({ width, height, scale: 1, fontScale: 1.5 });
    const handlers: Record<string, (...args: any[]) => void> = {};
    const removed: jest.Mock[] = [];
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, handler) => {
      handlers[event] = handler;
      const remove = jest.fn();
      removed.push(remove);
      return { remove };
    });
    let tree!: Renderer.ReactTestRenderer;
    try {
      await act(async () => {
        tree = Renderer.create(<ChatScreen navigation={{ setOptions: jest.fn() } as any} route={{ params: { chatId: 'chat', otherProfileId: 'other' } } as any} />);
      });
      const input = () => tree.root.findByType(TextInput);
      expect(tree.root.findByType(KeyboardAvoidingView).props.behavior).toBe(os === 'ios' ? 'padding' : 'height');
      act(() => input().props.onChangeText('Unsent draft'));
      act(() => handlers[Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow']());
      expect(input().props.value).toBe('Unsent draft');
      const composer = tree.root.findAllByType(View).find(node => StyleSheet.flatten(node.props.style)?.paddingTop === 10 && StyleSheet.flatten(node.props.style)?.paddingHorizontal === 14);
      expect(StyleSheet.flatten(composer?.props.style).paddingBottom).toBe(8);
      act(() => handlers[Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide']());
      expect(input().props.value).toBe('Unsent draft');
      act(() => tree.unmount());
      expect(removed.every(remove => remove.mock.calls.length === 1)).toBe(true);
    } finally {
      spy.mockRestore();
      dimensions.mockRestore();
      platform.restore();
    }
  });
});

test('a removed match disables the composer without treating it as a block', async () => {
  const send = useAppData().sendMessage as jest.Mock;
  send.mockRejectedValueOnce({ status: 403, code: 'match_removed', message: 'This match has been removed.' });
  const alert = jest.spyOn(Native.Alert, 'alert').mockImplementation(() => {});
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<ChatScreen navigation={{ setOptions: jest.fn() } as any} route={{ params: { chatId: 'chat', otherProfileId: 'other' } } as any} />);
    });
    act(() => tree.root.findByType(TextInput).props.onChangeText('Hello'));
    await act(async () => { await tree.root.findAllByProps({ accessibilityLabel: 'Send message' })[0].props.onPress(); });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(useAppData().disconnectFromChat).toHaveBeenCalled();
  } finally {
    if (tree) await act(async () => tree.unmount());
    alert.mockRestore();
    send.mockClear();
  }
});

test('free account without premium locks the chat composer and hides TextInput', async () => {
  mockIsPremium = false;
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(
        <ChatScreen
          navigation={{ setOptions: jest.fn(), navigate: jest.fn() } as any}
          route={{ params: { chatId: 'chat', otherProfileId: 'other' } } as any}
        />,
      );
    });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    const upgradeButton = tree.root.findByProps({ accessibilityLabel: 'Upgrade to Gold to unlock chat' });
    expect(upgradeButton).toBeTruthy();
  } finally {
    mockIsPremium = true;
    if (tree) await act(async () => tree.unmount());
  }
});


test('loading history preserves the reading position instead of forcing the newest message', async () => {
  jest.useFakeTimers();
  const data = useAppData();
  const rows = [{ id: 'latest', chatId: 'chat', senderId: 'other', text: 'Latest', createdAt: 20 }];
  (data.getMessagesForChat as jest.Mock).mockReturnValue(rows);
  (data.getChatHistoryState as jest.Mock).mockReturnValue({ next: 'older', loading: false });
  let tree!: Renderer.ReactTestRenderer;
  const props: any = { navigation: { setOptions: jest.fn() }, route: { params: { chatId: 'chat', otherProfileId: 'other' } } };
  let scroll: jest.SpyInstance | undefined;
  try {
    await act(async () => { tree = Renderer.create(<ChatScreen {...props} />); });
    await act(async () => { jest.advanceTimersByTime(100); });
    const list = tree.root.findByType(Native.FlatList);
    scroll = jest.spyOn(list.instance, 'scrollToEnd').mockImplementation(() => {});
    await act(async () => tree.root.findAllByProps({ accessibilityLabel: 'Load more history' })[0].props.onPress());
    expect(data.loadOlderChatMessages).toHaveBeenCalledWith('chat', 'other');
    (data.getMessagesForChat as jest.Mock).mockReturnValue([{ ...rows[0], id: 'older', text: 'Older', createdAt: 1 }, ...rows]);
    await act(async () => { tree.update(<ChatScreen {...props} />); });
    await act(async () => { jest.advanceTimersByTime(100); tree.root.findByType(Native.FlatList).props.onContentSizeChange(300, 1000); });
    expect(scroll).not.toHaveBeenCalled();
    expect(tree.root.findByType(Native.FlatList).props.maintainVisibleContentPosition).toEqual({ minIndexForVisible: 1 });
  } finally {
    scroll?.mockRestore();
    if (tree) await act(async () => tree.unmount());
    (data.getMessagesForChat as jest.Mock).mockReturnValue([]);
    (data.getChatHistoryState as jest.Mock).mockReturnValue({ next: null, loading: false });
    jest.useRealTimers();
  }
});

test('an unavailable optional block check does not show a connection error or disable chat', async () => {
  const check = blockService.checkIfBlockedBy as jest.Mock;
  check.mockReset().mockResolvedValueOnce(null);
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<ChatScreen navigation={{ setOptions: jest.fn() } as any} route={{ params: { chatId: 'unknown-chat', otherProfileId: 'other' } } as any} />);
    });
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Check connection status' })).toHaveLength(0);
    expect(tree.root.findAllByType(Native.Text).flatMap(node => [node.props.children].flat()).filter(child => typeof child === 'string').join(' ')).not.toContain('We couldn’t check this connection');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);

  } finally {
    if (tree) await act(async () => tree.unmount());
  }
});

test('an authoritative blocked-by-user send denial disables replies without the optional check', async () => {
  const send = useAppData().sendMessage as jest.Mock;
  const check = blockService.checkIfBlockedBy as jest.Mock;
  check.mockReset();
  let finishCheck!: (blocked: boolean | null) => void;
  check.mockImplementationOnce(() => new Promise(resolve => { finishCheck = resolve; }));
  send.mockRejectedValueOnce({ status: 403, code: 'blocked_by_user', message: 'Messaging is unavailable.' });
  const alert = jest.spyOn(Native.Alert, 'alert').mockImplementation(() => {});
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => {
      tree = Renderer.create(<ChatScreen navigation={{ setOptions: jest.fn() } as any} route={{ params: { chatId: 'blocked-chat', otherProfileId: 'other' } } as any} />);
    });
    act(() => tree.root.findByType(TextInput).props.onChangeText('Hello'));
    await act(async () => tree.root.findAllByProps({ accessibilityLabel: 'Send message' })[0].props.onPress());
    await act(async () => finishCheck(false));
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(tree.root.findAllByType(Native.Text).flatMap(node => [node.props.children].flat()).filter(child => typeof child === 'string').join(' ')).toContain("You can't reply to this conversation.");
  } finally {
    if (tree) await act(async () => tree.unmount());
    alert.mockRestore(); send.mockClear();
  }
});

test('chat offers Unconnect, disables the composer when ended, and restores it after reconnection', async () => {
  const data = useAppData() as any;
  data.getInterestRelationship = () => ({ status: 'accepted', activeInterest: { id: 'match' } });
  data.cancelInterest = jest.fn().mockResolvedValue(undefined);
  data.chats = [{ id: 'chat', connectionClosed: false }];
  const alert = jest.spyOn(Native.Alert, 'alert').mockImplementation(() => {});
  const props: any = { navigation: { setOptions: jest.fn() }, route: { params: { chatId: 'chat', otherProfileId: 'other' } } };
  let tree!: Renderer.ReactTestRenderer;
  try {
    await act(async () => { tree = Renderer.create(<ChatScreen {...props} />); });
    await act(async () => { tree.root.findAllByProps({ accessibilityLabel: 'Chat options' })[0].props.onPress(); });
    const action = tree.root.findAllByType(Native.TouchableOpacity).find(node => node.props.accessibilityLabel === 'Unconnect')!;
    await act(async () => { action.props.onPress(); });
    const actions = alert.mock.calls[alert.mock.calls.length - 1][2]!;
    await act(async () => { await actions.find(item => item.text === 'Unconnect')!.onPress!(); });
    expect(data.cancelInterest).toHaveBeenCalledWith('match');
    data.chats = [{ id: 'chat', connectionClosed: true }];
    await act(async () => { tree.update(<ChatScreen {...props} />); });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(tree.root.findAllByType(Native.Text).some(node => node.props.children === 'This connection has ended. Messaging is unavailable.')).toBe(true);
    data.chats = [{ id: 'chat', connectionClosed: false }];
    await act(async () => { tree.update(<ChatScreen {...props} />); });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  } finally {
    if (tree) await act(async () => tree.unmount());
    delete data.chats;
    delete data.getInterestRelationship;
    delete data.cancelInterest;
    alert.mockRestore();
  }
});

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
    clear: jest.fn(async () => { values.clear(); }),
  };
});
