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
    getMessagesForChat: () => [],
    loadChatMessages: jest.fn().mockResolvedValue(undefined),
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
