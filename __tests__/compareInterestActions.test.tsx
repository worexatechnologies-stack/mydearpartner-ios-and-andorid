import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import CompareScreen from '../src/screens/member/CompareScreen';

const mockProfile = { id: 'partner', name: 'Partner', age: 28, interests: [] };
let mockRelationship: any;
const mockCancel = jest.fn();
const mockAccept = jest.fn();
const mockSend = jest.fn();
const mockGetChat = jest.fn().mockResolvedValue({ id: 'chat' });
const mockNavigate = jest.fn();
jest.mock('../src/context/AppDataContext', () => ({
  useAppData: () => ({
    discoverProfiles: [mockProfile],
    getInterestRelationship: () => mockRelationship,
    cancelInterest: mockCancel,
    respondToInterest: mockAccept,
    sendInterest: mockSend,
    getOrCreateChatWith: mockGetChat,
  }),
}));
jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ currentUser: { profile: { id: 'me', name: 'Me', interests: [] } } }),
}));
jest.mock('../src/utils/planAllowance', () => ({
  usePlanAllowance: () => ({ isInterestsExhausted: true }),
}));
jest.mock('../src/utils/haptics', () => ({ triggerHaptic: jest.fn() }));
jest.mock('../src/utils/compatibility', () => ({ computeCompatibilityScore: () => 90 }));
jest.mock('../src/components/ScreenContainer', () => {
  const { View } = require('react-native');
  return View;
});
jest.mock('../src/components/AuthImage', () => {
  const { View } = require('react-native');
  return View;
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test.each([
  ['accepted', 'Send Message'],
  ['received', 'Accept Interest'],
  ['sent', 'Interest Sent (Tap to Unsend)'],
])('%s relationship uses its safe action even with exhausted sending quota', async (status, label) => {
  mockRelationship = {
    status,
    isMutual: status === 'accepted',
    sent: status === 'sent' ? { id: 'sent-id', status: 'pending' } : undefined,
    received: status === 'received' ? { id: 'received-id', status: 'pending' } : undefined,
  };
  let tree!: Renderer.ReactTestRenderer;
  await act(async () => {
    tree = Renderer.create(<CompareScreen navigation={{ navigate: mockNavigate } as any} route={{ params: { profileId1: 'partner' } } as any} />);
  });
  const button = tree.root.findAllByType(TouchableOpacity).find(node =>
    node.findAllByType(Text).some(text => text.props.children === label),
  );
  expect(button).toBeDefined();
  await act(async () => { await button!.props.onPress(); });
  if (status === 'accepted') {
    expect(mockGetChat).toHaveBeenCalledWith('partner');
    expect(mockNavigate).toHaveBeenCalledWith('Chat', { chatId: 'chat', otherProfileId: 'partner' });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockAccept).not.toHaveBeenCalled();
  } else if (status === 'received') {
    expect(mockAccept).toHaveBeenCalledWith('received-id', 'accepted');
    expect(mockCancel).not.toHaveBeenCalled();
  } else {
    expect(mockCancel).toHaveBeenCalledWith('sent-id');
    expect(mockAccept).not.toHaveBeenCalled();
  }
  expect(mockSend).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});
