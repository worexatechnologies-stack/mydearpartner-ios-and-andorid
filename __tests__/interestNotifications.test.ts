import {
  interestEventKind,
  notifyInterest,
} from '../src/services/InterestNotificationService';
import { handleIncomingPush } from '../src/services/IncomingPushService';
import { displayNotification } from '../src/services/PushNotificationService';
import { showInAppNotification } from '../src/utils/notifications';
import { handleIncomingMessagePush } from '../src/services/MessageNotificationService';
jest.mock('../src/services/PushNotificationService', () => ({
  displayNotification: jest.fn().mockResolvedValue(true),
  handleNotificationPress: jest.fn(),
  CHANNEL_ID_INTERESTS: 'mdp_interests_v2',
}));
jest.mock('../src/utils/notifications', () => ({
  showInAppNotification: jest.fn(),
}));
jest.mock('../src/services/MessageNotificationService', () => ({
  handleIncomingMessagePush: jest.fn(),
}));
jest.mock('../src/utils/keychain', () => ({
  getUserIds: jest.fn().mockResolvedValue({}),
}));

beforeEach(() => jest.clearAllMocks());
test('interest with a conversation ID remains an interest and appears immediately', async () => {
  await handleIncomingPush(
    {
      data: {
        kind: 'interest_accepted',
        interest_id: 'accepted-with-chat',
        conversation_id: 'chat',
        sender_name: 'Alex',
      },
    },
    true,
  );
  expect(handleIncomingMessagePush).not.toHaveBeenCalled();
  expect(displayNotification).toHaveBeenCalledWith(
    "It's a match",
    'Alex accepted your interest.',
    expect.any(Object),
    'interest-interest_accepted:accepted-with-chat',
    'mdp_interests_v2',
  );
  expect(showInAppNotification).not.toHaveBeenCalled();
});
test('push and REST duplicates show only one banner', async () => {
  await Promise.all([
    notifyInterest({ id: 'dupe', kind: 'interest_received' }, true),
    notifyInterest({ id: 'dupe', kind: 'interest_received' }, true),
  ]);
  expect(displayNotification).toHaveBeenCalledTimes(1);
});
test('accepted interest is not suppressed by an earlier received notification', async () => {
  await notifyInterest({ id: 'lifecycle', kind: 'interest_received' }, true);
  await notifyInterest({ id: 'lifecycle', kind: 'interest_accepted' }, true);
  expect(displayNotification).toHaveBeenCalledTimes(2);
});
test('failed background display can be retried', async () => {
  (displayNotification as jest.Mock)
    .mockResolvedValueOnce(false)
    .mockResolvedValueOnce(true);
  await notifyInterest({ id: 'retry', kind: 'interest_received' }, false);
  await notifyInterest({ id: 'retry', kind: 'interest_received' }, false);
  expect(displayNotification).toHaveBeenCalledTimes(2);
});
test('OS-rendered background alerts are not duplicated', async () => {
  await handleIncomingPush({
    notification: { title: 'New interest' },
    data: { interest_id: 'system' },
  });
  expect(displayNotification).not.toHaveBeenCalled();
  expect(showInAppNotification).not.toHaveBeenCalled();
});
test('supports websocket types and camelCase interest identifiers', () => {
  expect(interestEventKind({ type: 'interest.received' })).toBe(
    'interest_received',
  );
  expect(interestEventKind({ interestId: 'id' })).toBe('interest_received');
  expect(interestEventKind({ type: 'chat_message' })).toBeNull();
});

test('saved-search realtime and push copies show one banner for the signed-in account', async () => {
  const { getUserIds } = require('../src/utils/keychain');
  getUserIds.mockResolvedValue({ memberId: 'me' });
  const data = { notification_type: 'SAVED_SEARCH_MATCH', notification_id: 'saved-alert-dupe', receiver_id: 'me',
    url: '/search?saved_search=aaaa1111-2222-3333-4444-555555555555' };
  await Promise.all([handleIncomingPush({ data }, true), handleIncomingPush({ data }, true)]);
  expect(showInAppNotification).toHaveBeenCalledTimes(1);
  expect(showInAppNotification).toHaveBeenCalledWith(expect.objectContaining({ type: 'system', onPress: expect.any(Function) }));
  expect(handleIncomingMessagePush).not.toHaveBeenCalled();
  expect(displayNotification).not.toHaveBeenCalled();
});

test('saved-search alerts addressed to an earlier account are ignored', async () => {
  const { getUserIds } = require('../src/utils/keychain');
  getUserIds.mockResolvedValue({ memberId: 'me' });
  await handleIncomingPush({ data: { notification_type: 'SAVED_SEARCH_MATCH', notification_id: 'old-account', receiver_id: 'other' } }, true);
  expect(showInAppNotification).not.toHaveBeenCalled();
  expect(displayNotification).not.toHaveBeenCalled();
});

test('system-rendered saved-search alerts do not create a second notification', async () => {
  const { getUserIds } = require('../src/utils/keychain');
  getUserIds.mockResolvedValue({ memberId: 'me' });
  await handleIncomingPush({ notification: { title: 'New matching profiles' }, data: {
    notification_type: 'SAVED_SEARCH_MATCH', notification_id: 'saved-system', receiver_id: 'me',
  } }, false);
  expect(showInAppNotification).not.toHaveBeenCalled();
  expect(displayNotification).not.toHaveBeenCalled();
});
