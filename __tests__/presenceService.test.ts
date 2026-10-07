import { DeviceEventEmitter } from 'react-native';
import { post } from '../src/api/apiClient';
import { presenceUserIds, subscribeToPresence } from '../src/services/PresenceService';
import { handleRealtimeNotification } from '../src/services/NotificationRealtimeService';
jest.mock('../src/api/apiClient', () => ({ post: jest.fn() }));

test('a stale REST response cannot undo a newer privacy event', async () => {
  let resolve!: (data: any) => void;
  (post as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const onPresence = jest.fn();
  const stop = subscribeToPresence('member', onPresence);
  expect(presenceUserIds()).toContain('member');
  await handleRealtimeNotification({ type: 'presence.changed', user_id: 'member', status: 'OFFLINE' });
  resolve({ member: 'ONLINE' });
  await Promise.resolve();
  expect(onPresence).toHaveBeenCalledTimes(1);
  expect(onPresence).toHaveBeenLastCalledWith(false);
  stop();
  expect(presenceUserIds()).not.toContain('member');
});

test('an unauthorized or missing snapshot clears previous online state', async () => {
  (post as jest.Mock).mockResolvedValue({ member: 'ONLINE' });
  const onPresence = jest.fn();
  const stop = subscribeToPresence('member', onPresence);
  await Promise.resolve();
  await handleRealtimeNotification({ type: 'presence.snapshot', data: { statuses: {} } });
  expect(onPresence).toHaveBeenLastCalledWith(false);
  stop();
  DeviceEventEmitter.emit('MEMBER_PRESENCE', { userId: 'member', online: true });
  expect(onPresence).toHaveBeenLastCalledWith(false);
});
