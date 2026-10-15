import { AppState, DeviceEventEmitter } from 'react-native';
import {
  startNotificationRealtime,
  handleRealtimeNotification,
} from '../src/services/NotificationRealtimeService';
import { loadTokens } from '../src/utils/keychain';
import { notifyInterest } from '../src/services/InterestNotificationService';
import { handleIncomingPush } from '../src/services/IncomingPushService';
jest.mock('../src/services/IncomingPushService', () => ({
  handleIncomingPush: jest.fn().mockResolvedValue(undefined),
}));
beforeEach(() => jest.clearAllMocks());
jest.mock('../src/utils/keychain', () => ({
  loadTokens: jest.fn().mockResolvedValue({ accessToken: 'test-token' }),
}));
jest.mock('../src/services/InterestNotificationService', () => ({
  ...jest.requireActual('../src/services/InterestNotificationService'),
  notifyInterest: jest.fn().mockResolvedValue(undefined),
}));

test('delivers realtime interests through the shared deduplicating alert handler', async () => {
  const emit = jest.spyOn(DeviceEventEmitter, 'emit');
  await handleRealtimeNotification({
    type: 'interest.received',
    entity_id: 'interest-10',
    data: { sender_name: 'Alex', profile_id: 'profile-10' },
  });
  expect(emit).toHaveBeenCalledWith('REFRESH_INTERESTS');
  expect(notifyInterest).toHaveBeenCalledWith(expect.objectContaining({
    id: 'interest-10', kind: 'interest_received', senderName: 'Alex',
  }), true);
  emit.mockRestore();
});
test('does not connect if token loading finishes after session cleanup', async () => {
  const previousState = AppState.currentState;
  AppState.currentState = 'active';
  let resolve: (value: { accessToken: string }) => void = () => {};
  (loadTokens as jest.Mock).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const constructor = jest.spyOn(global, 'WebSocket');
  const stop = startNotificationRealtime();
  stop();
  resolve({ accessToken: 'old-session-token' });
  await Promise.resolve();
  expect(constructor).not.toHaveBeenCalled();
  constructor.mockRestore();
  AppState.currentState = previousState;
});

test('match removal refreshes the open thread and both activity lists', async () => {
  const emit = jest.spyOn(DeviceEventEmitter, 'emit');
  await handleRealtimeNotification({ type: 'notification.created', data: { notification_type: 'MATCH_REMOVED' } });
  expect(emit).toHaveBeenCalledWith('REFRESH_INTERESTS');
  expect(emit).toHaveBeenCalledWith('REFRESH_CHATS');
  expect(emit).toHaveBeenCalledWith('REFRESH_ACTIVE_CHAT');
  emit.mockRestore();
});

test('uppercase backend chat notifications use the shared push handler', async () => {
  await handleRealtimeNotification({ type: 'notification.created', notification_type: 'CHAT_MESSAGE', data: { message_id: 'message-1', conversation_id: 'chat-1' } });
  expect(handleIncomingPush).toHaveBeenCalledWith({ data: expect.objectContaining({ kind: 'chat_message', message_id: 'message-1' }) }, true);
});

test('incomplete chat refresh events do not generate undeduplicated alerts', async () => {
  await handleRealtimeNotification({ type: 'chat.message', data: { conversation_id: 'chat-1' } });
  expect(handleIncomingPush).not.toHaveBeenCalled();
});
