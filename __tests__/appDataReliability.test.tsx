import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AppDataProvider, useAppData } from '../src/context/AppDataContext';
import * as ChatService from '../src/api/chatService';
import * as InterestService from '../src/api/interestService';
import { chatWsClient } from '../src/api/wsClient';
const mockUser = { id: 'me', profile: { id: 'me', gender: 'male' } };
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser, refreshCurrentUser: jest.fn() }) }));
jest.mock('../src/utils/keychain', () => ({ loadTokens: jest.fn().mockResolvedValue({ accessToken: 'token' }), saveUserIds: jest.fn() }));
jest.mock('../src/utils/jwt', () => ({ getMemberUserIdFromToken: () => 'me' }));
jest.mock('../src/services/MessagingCryptoLifecycle', () => ({ waitForMessagingCryptoReady: jest.fn().mockResolvedValue('me') }));
jest.mock('../src/utils/crypto', () => ({ encryptMessageForChat: jest.fn().mockResolvedValue('encrypted'), smartDecryptText: jest.fn(async text => text) }));
jest.mock('../src/api/profileService', () => ({ getDiscoverProfiles: jest.fn().mockResolvedValue({ profiles: [] }) }));
jest.mock('../src/api/apiClient', () => ({ get: jest.fn().mockResolvedValue([]) }));
jest.mock('../src/api/chatService', () => ({ getChats: jest.fn().mockResolvedValue([]), getMessages: jest.fn(), getMessagePage: jest.fn(), sendMessage: jest.fn(), getOrCreateChat: jest.fn() }));
jest.mock('../src/api/interestService', () => ({ getReceivedInterests: jest.fn().mockResolvedValue([]), getSentInterests: jest.fn().mockResolvedValue([]), sendInterest: jest.fn(), respondToInterest: jest.fn(), removeConnection: jest.fn().mockResolvedValue(undefined), cancelInterest: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../src/api/blockService', () => ({ blockService: { getBlockedUsers: jest.fn().mockResolvedValue([]) } }));
jest.mock('../src/api/wsClient', () => ({ chatWsClient: { sendMessage: jest.fn().mockReturnValue(true), disconnect: jest.fn(), connect: jest.fn() } }));
jest.mock('../src/utils/planAllowance', () => ({ recordInterestSentToday: jest.fn().mockResolvedValue(undefined), markDailyInterestsExhausted: jest.fn() }));
let data: ReturnType<typeof useAppData>;
let tree: ReactTestRenderer;
function Capture() { data = useAppData(); return null; }
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (ChatService.getMessagePage as jest.Mock).mockImplementation(async (...args) => ({ messages: await (ChatService.getMessages as jest.Mock)(...args.slice(0, 3)), next: null }));
  await act(async () => { tree = create(<AppDataProvider><Capture /></AppDataProvider>); });
});
afterEach(async () => { await act(async () => tree.unmount()); jest.useRealTimers(); });
const message = (id: string) => ({ id, chatId: 'chat', senderId: 'partner', text: id, createdAt: Number(id) });
test('refresh fetches new messages even after history is cached, without duplicates', async () => {
  (ChatService.getMessages as jest.Mock).mockResolvedValueOnce([message('1')]).mockResolvedValueOnce([message('1'), message('2')]);
  await act(async () => { await data.loadChatMessages('chat', 'partner'); });
  await act(async () => { await data.loadChatMessages('chat', 'partner'); });
  expect(ChatService.getMessages).toHaveBeenCalledTimes(2);
  expect(data.getMessagesForChat('chat').map(item => item.id)).toEqual(['1', '2']);
});
test('send waits for server persistence instead of trusting a socket buffer write', async () => {
  (ChatService.sendMessage as jest.Mock).mockRejectedValue(new Error('offline'));
  await act(async () => { await expect(data.sendMessage('chat', 'Hello', 'partner')).rejects.toThrow('offline'); });
  expect(chatWsClient.sendMessage).not.toHaveBeenCalled();
  expect(ChatService.sendMessage).toHaveBeenCalledWith('chat', 'encrypted', 'partner');
  expect(data.getMessagesForChat('chat')).toEqual([expect.objectContaining({ text: 'Hello', deliveryStatus: 'unconfirmed' })]);
  const row = data.getMessagesForChat('chat')[0];
  await expect(data.sendMessage('chat', row.text, 'partner', row.id)).rejects.toThrow('Refresh the conversation');
  expect(ChatService.sendMessage).toHaveBeenCalledTimes(1);
  await act(async () => { data.dismissLocalMessage('chat', row.id); });
  expect(data.getMessagesForChat('chat')).toEqual([]);
});
test('two rapid interest taps issue only one mutation', async () => {
  (InterestService.sendInterest as jest.Mock).mockResolvedValue({ id: 'request', fromUserId: 'me', toUserId: 'partner', status: 'pending' });
  await act(async () => { await Promise.all([data.sendInterest('partner'), data.sendInterest('partner')]); });
  expect(InterestService.sendInterest).toHaveBeenCalledTimes(1);
});

test('an older activity refresh cannot resurrect an accepted request', async () => {
  const pending = { id: 'received', fromUserId: 'partner', toUserId: 'me', status: 'pending', createdAt: 1 };
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValueOnce([pending]);
  await act(async () => { await data.refreshInterests(); });
  let finish!: (items: unknown[]) => void;
  (InterestService.getReceivedInterests as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let refresh!: Promise<void>;
  await act(async () => { refresh = data.refreshInterests(); });
  (InterestService.respondToInterest as jest.Mock).mockResolvedValue({ ...pending, status: 'accepted' });
  (ChatService.getOrCreateChat as jest.Mock).mockRejectedValue(new Error('chat temporarily unavailable'));
  await act(async () => { await data.respondToInterest('received', 'accepted'); });
  await act(async () => { finish([pending]); await refresh; });
  expect(data.receivedInterests.find(item => item.id === 'received')?.status).toBe('accepted');
});


test('concurrent chat refreshes share initialization and issue one list request', async () => {
  const { waitForMessagingCryptoReady } = require('../src/services/MessagingCryptoLifecycle');
  let ready!: (id: string) => void;
  waitForMessagingCryptoReady.mockReturnValueOnce(new Promise(resolve => { ready = resolve; }));
  (ChatService.getChats as jest.Mock).mockClear();
  let pending!: Promise<void[]>;
  await act(async () => { pending = Promise.all([data.refreshChats(), data.refreshChats()]); });
  await act(async () => { ready('me'); await pending; });
  expect(ChatService.getChats).toHaveBeenCalledTimes(1);
});


test('shows sending until the persisted response replaces the local row', async () => {
  let finish!: (value: unknown) => void;
  (ChatService.sendMessage as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  await act(async () => { pending = data.sendMessage('chat', 'Pending text', 'partner'); });
  expect(data.getMessagesForChat('chat')[0].deliveryStatus).toBe('sending');
  await act(async () => { finish({ id: 'saved', senderId: 'me', createdAt: Date.now(), deliveryStatus: 'sent' }); await pending; });
  expect(data.getMessagesForChat('chat')).toEqual([expect.objectContaining({ id: 'saved', text: 'Pending text', deliveryStatus: 'sent' })]);
});

test('a definitive rejection can be retried once without duplicate local rows', async () => {
  (ChatService.sendMessage as jest.Mock).mockRejectedValueOnce({ status: 403, message: 'Denied' });
  await act(async () => { await expect(data.sendMessage('chat', 'Retry me', 'partner')).rejects.toMatchObject({ status: 403 }); });
  const failed = data.getMessagesForChat('chat')[0];
  expect(failed.deliveryStatus).toBe('failed');
  (ChatService.sendMessage as jest.Mock).mockResolvedValueOnce({ id: 'retry-saved', senderId: 'me', createdAt: Date.now() });
  await act(async () => { await Promise.all([
    data.sendMessage('chat', failed.text, 'partner', failed.id),
    data.sendMessage('chat', failed.text, 'partner', failed.id),
  ]); });
  expect(ChatService.sendMessage).toHaveBeenCalledTimes(2);
  expect(data.getMessagesForChat('chat')).toEqual([expect.objectContaining({ id: 'retry-saved', deliveryStatus: 'sent' })]);
});

test('encryption selects the other participant rather than the sender', async () => {
  (ChatService.getChats as jest.Mock).mockResolvedValueOnce([{ id: 'chat', participantIds: ['me', 'member-partner'] }]);
  await act(async () => { await data.refreshChats(); });
  (ChatService.sendMessage as jest.Mock).mockResolvedValueOnce({ id: 'saved-other', senderId: 'me', createdAt: Date.now() });
  await act(async () => { await data.sendMessage('chat', 'Hello partner', 'profile-partner'); });
  expect(ChatService.sendMessage).toHaveBeenCalledWith('chat', 'encrypted', 'member-partner');
});

test('older pages merge without duplicates, rewind, cursor reset, or parallel requests', async () => {
  (ChatService.getMessagePage as jest.Mock).mockResolvedValueOnce({ messages: [message('3'), message('4')], next: 'page-two' });
  await act(async () => { await data.loadChatMessages('chat', 'partner'); });
  expect(data.getChatHistoryState('chat').next).toBe('page-two');
  let finish!: (value: unknown) => void;
  (ChatService.getMessagePage as jest.Mock).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void[]>;
  await act(async () => { pending = Promise.all([data.loadOlderChatMessages('chat', 'partner'), data.loadOlderChatMessages('chat', 'partner')]); });
  expect(data.getChatHistoryState('chat').loading).toBe(true);
  await act(async () => { finish({ messages: [message('1'), message('3')], next: 'page-three' }); await pending; });
  expect(ChatService.getMessagePage).toHaveBeenCalledTimes(2);
  expect(data.getMessagesForChat('chat').map(m => m.id)).toEqual(['1', '3', '4']);
  (ChatService.getMessagePage as jest.Mock).mockResolvedValueOnce({ messages: [message('4'), message('5')], next: 'page-two' });
  await act(async () => { await data.loadChatMessages('chat', 'partner'); });
  expect(data.getChatHistoryState('chat').next).toBe('page-three');
  expect(data.getMessagesForChat('chat').map(m => m.id)).toEqual(['1', '3', '4', '5']);
});
test('a failed older page keeps its cursor for retry and a repeated cursor ends the loop', async () => {
  (ChatService.getMessagePage as jest.Mock).mockResolvedValueOnce({ messages: [message('3')], next: 'older' });
  await act(async () => { await data.loadChatMessages('chat', 'partner'); });
  (ChatService.getMessagePage as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { await expect(data.loadOlderChatMessages('chat', 'partner')).rejects.toThrow('offline'); });
  expect(data.getChatHistoryState('chat')).toMatchObject({ next: 'older', loading: false, error: expect.any(String) });
  (ChatService.getMessagePage as jest.Mock).mockResolvedValueOnce({ messages: [message('1')], next: 'older' });
  await act(async () => { await data.loadOlderChatMessages('chat', 'partner'); });
  expect(data.getChatHistoryState('chat')).toMatchObject({ next: null, loading: false, error: undefined });
  expect(data.getMessagesForChat('chat').map(m => m.id)).toEqual(['1', '3']);
});


test('unconnecting clears both directions and restores discovery despite chat history', async () => {
  const partner = { id: 'partner-profile', userId: 'partner', name: 'Partner', gender: 'female' };
  const sent = { id: 'sent-match', fromUserId: 'me', toUserId: 'partner', receiverProfile: partner, status: 'accepted', createdAt: 1 };
  const received = { id: 'received-match', fromUserId: 'partner', toUserId: 'me', senderProfile: partner, status: 'accepted', createdAt: 1 };
  (InterestService.getSentInterests as jest.Mock).mockResolvedValue([sent]);
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValue([received]);
  (ChatService.getChats as jest.Mock).mockResolvedValue([{ id: 'old-chat', participantIds: ['me', 'partner'], otherProfile: partner }]);
  const { getDiscoverProfiles } = require('../src/api/profileService');
  getDiscoverProfiles.mockResolvedValue({ profiles: [partner] });
  await act(async () => { await data.refreshInterests(); await data.refreshChats(); });
  await act(async () => { await data.refreshDiscoverProfiles(); });
  expect(data.getInterestRelationship(partner.id).status).toBe('accepted');
  expect(data.discoverProfiles).toEqual([]);
  (InterestService.getSentInterests as jest.Mock).mockResolvedValue([]);
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValue([{ ...received, status: 'declined' }]);
  await act(async () => { await data.cancelInterest(sent.id); });
  expect(InterestService.removeConnection).toHaveBeenCalledWith(sent.id);
  expect(InterestService.respondToInterest).toHaveBeenCalledWith(received.id, 'declined');
  expect(data.getInterestRelationship(partner.id).status).toBe('none');
  expect(data.discoverProfiles.map(profile => profile.id)).toContain(partner.id);
  await act(async () => { await data.refreshInterests(); await data.refreshDiscoverProfiles(); });
  expect(data.getInterestRelationship(partner.id).status).toBe('declined');
  expect(data.discoverProfiles.map(profile => profile.id)).toContain(partner.id);
});

test('a partner removing the connection closes chat and accepting again reopens it', async () => {
  const partner = { id: 'reconnect-profile', userId: 'reconnect-user', name: 'Partner', gender: 'female' };
  const { getDiscoverProfiles } = require('../src/api/profileService');
  getDiscoverProfiles.mockResolvedValue({ profiles: [partner] });
  const match = { id: 'reconnect-match', fromUserId: 'reconnect-user', toUserId: 'me', senderProfile: partner, status: 'accepted', createdAt: 1 };
  (ChatService.getChats as jest.Mock).mockResolvedValue([{ id: 'reconnect-chat', participantIds: ['me', partner.userId], otherProfile: partner }]);
  (InterestService.getSentInterests as jest.Mock).mockResolvedValue([]);
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValue([match]);
  await act(async () => { await data.refreshChats(); });
  await act(async () => { await data.refreshInterests(); });
  expect(data.chats.find(chat => chat.id === 'reconnect-chat')?.connectionClosed).toBe(false);
  expect(data.discoverProfiles.map(profile => profile.id)).not.toContain(partner.id);
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValue([]);
  await act(async () => { await data.refreshInterests(); });
  expect(data.chats.find(chat => chat.id === 'reconnect-chat')?.connectionClosed).toBe(true);
  expect(data.discoverProfiles.map(profile => profile.id)).toContain(partner.id);
  await act(async () => { await expect(data.sendMessage('reconnect-chat', 'Hello', partner.userId)).rejects.toThrow('removed'); });
  (InterestService.getReceivedInterests as jest.Mock).mockResolvedValue([{ ...match, id: 'new-match' }]);
  await act(async () => { await data.refreshInterests(); });
  expect(data.chats.find(chat => chat.id === 'reconnect-chat')?.connectionClosed).toBe(false);
});
