import { Platform } from 'react-native';
import { handleIncomingMessagePush } from '../src/services/MessageNotificationService';
import { displayNotification } from '../src/services/PushNotificationService';
import { getChats } from '../src/api/chatService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/api/chatService', () => ({ getChats: jest.fn(), getMessages: jest.fn() }));
jest.mock('../src/utils/crypto', () => ({
  E2EE_DECRYPT_FAILED: 'failed',
  smartDecryptText: jest.fn().mockResolvedValue('Hello'),
}));
jest.mock('../src/services/PushNotificationService', () => ({ displayNotification: jest.fn() }));
jest.mock('../src/services/MessagingCryptoLifecycle', () => ({ waitForMessagingCryptoReady: jest.fn().mockResolvedValue('me') }));
jest.mock('../src/utils/keychain', () => ({ getUserIds: jest.fn().mockResolvedValue({ memberId: 'me' }) }));

const push = (id: string) => ({ data: {
  message_id: id, conversation_id: 'chat', sender_id: 'other', receiver_id: 'me',
  encrypted_text: 'encrypted', sender_name: 'Alex',
} });
const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  (displayNotification as jest.Mock).mockResolvedValue(true);
  const { waitForMessagingCryptoReady } = require('../src/services/MessagingCryptoLifecycle');
  waitForMessagingCryptoReady.mockResolvedValue('me');
});
afterEach(() => { Platform.OS = originalOS; });

test('foreground iOS data-only push displays immediately without a chat-list request', async () => {
  Platform.OS = 'ios';
  await handleIncomingMessagePush(push('ios-data'), true);
  expect(displayNotification).toHaveBeenCalledWith('Alex', 'Hello', expect.any(Object), 'ios-data', 'mdp_messages_v2');
  expect(getChats).not.toHaveBeenCalled();
});

test('foreground iOS alert displays one local banner', async () => {
  Platform.OS = 'ios';
  await handleIncomingMessagePush({ ...push('ios-alert'), notification: { title: 'Alex', body: 'Hello' } }, true);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});

test('concurrent copies of one message display once', async () => {
  Platform.OS = 'android';
  await Promise.all([
    handleIncomingMessagePush(push('concurrent'), true),
    handleIncomingMessagePush(push('concurrent'), true),
  ]);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});

test('failed display permits the same message to retry', async () => {
  Platform.OS = 'android';
  (displayNotification as jest.Mock).mockResolvedValueOnce(false);
  await handleIncomingMessagePush(push('retry'), true);
  await handleIncomingMessagePush(push('retry'), true);
  expect(displayNotification).toHaveBeenCalledTimes(2);
});

test('foreground push routing refreshes screens and displays without loading unrelated native modules', async () => {
  const { DeviceEventEmitter } = require('react-native');
  const emit = jest.spyOn(DeviceEventEmitter, 'emit');
  const { handleIncomingPush } = require('../src/services/IncomingPushService');
  await handleIncomingPush(push('routing'), true);
  expect(emit).toHaveBeenCalledWith('REFRESH_CHATS');
  expect(displayNotification).toHaveBeenCalledTimes(1);
  emit.mockRestore();
});


test('persisted IDs cannot bypass a failed cryptographic readiness gate', async () => {
  const { waitForMessagingCryptoReady } = require('../src/services/MessagingCryptoLifecycle');
  const { smartDecryptText } = require('../src/utils/crypto');
  waitForMessagingCryptoReady.mockResolvedValue(null);
  await handleIncomingMessagePush(push('no-session'), true);
  expect(smartDecryptText).not.toHaveBeenCalled();
  expect(displayNotification).toHaveBeenCalledWith('Alex', 'You have a new message', expect.any(Object), 'no-session', 'mdp_messages_v2');
});

test('background data-only chat displays a notification', async () => {
  const { handleIncomingPush } = require('../src/services/IncomingPushService');
  await handleIncomingPush(push('background-data'), false);
  expect(displayNotification).toHaveBeenCalledWith('Alex', 'Hello', expect.any(Object), 'background-data', 'mdp_messages_v2');
});

test('background system-rendered chat does not create a duplicate', async () => {
  const { handleIncomingPush } = require('../src/services/IncomingPushService');
  await handleIncomingPush({ ...push('background-alert'), notification: { title: 'Alex', body: 'New message' } }, false);
  expect(displayNotification).not.toHaveBeenCalled();
});

test('chat previews mentioning likes or matches stay on the message channel', async () => {
  const { handleIncomingPush } = require('../src/services/IncomingPushService');
  await handleIncomingPush({ ...push('chat-like'), notification: { title: 'Alex', body: 'I like your profile, we match!' } }, true);
  expect(displayNotification).toHaveBeenCalledWith('Alex', 'Hello', expect.any(Object), 'chat-like', 'mdp_messages_v2');
});
test('push addressed to a different signed-in account is ignored', async () => {
  await handleIncomingMessagePush({ data: { ...push('other-account').data, receiver_id: 'previous-account' } }, true);
  expect(displayNotification).not.toHaveBeenCalled();
});
test('logout during decryption prevents a private notification from appearing', async () => {
  const { waitForMessagingCryptoReady } = require('../src/services/MessagingCryptoLifecycle');
  const { smartDecryptText } = require('../src/utils/crypto');
  smartDecryptText.mockImplementationOnce(async () => {
    waitForMessagingCryptoReady.mockResolvedValue(null);
    return 'Private message';
  });
  await handleIncomingMessagePush(push('logout-during-decrypt'), true);
  expect(displayNotification).not.toHaveBeenCalled();
});
