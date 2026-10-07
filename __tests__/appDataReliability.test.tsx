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
jest.mock('../src/api/chatService', () => ({ getChats: jest.fn().mockResolvedValue([]), getMessages: jest.fn(), sendMessage: jest.fn(), getOrCreateChat: jest.fn() }));
jest.mock('../src/api/interestService', () => ({ getReceivedInterests: jest.fn().mockResolvedValue([]), getSentInterests: jest.fn().mockResolvedValue([]), sendInterest: jest.fn(), respondToInterest: jest.fn() }));
jest.mock('../src/api/blockService', () => ({ blockService: { getBlockedUsers: jest.fn().mockResolvedValue([]) } }));
jest.mock('../src/api/wsClient', () => ({ chatWsClient: { sendMessage: jest.fn().mockReturnValue(true), disconnect: jest.fn(), connect: jest.fn() } }));
jest.mock('../src/utils/planAllowance', () => ({ recordInterestSentToday: jest.fn().mockResolvedValue(undefined), markDailyInterestsExhausted: jest.fn() }));
let data: ReturnType<typeof useAppData>;
let tree: ReactTestRenderer;
function Capture() { data = useAppData(); return null; }
beforeEach(async () => {
  jest.useFakeTimers(); jest.clearAllMocks();
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
