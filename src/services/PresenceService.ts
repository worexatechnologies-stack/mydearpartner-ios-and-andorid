import { DeviceEventEmitter } from 'react-native';
import { post } from '../api/apiClient';

const subscriptions = new Map<string, number>();
export const presenceUserIds = () => [...subscriptions.keys()];

/** Subscribe only to server-authorized, privacy-filtered member presence. */
export function subscribeToPresence(userId: string, callback: (online: boolean) => void) {
  let active = true;
  let receivedEvent = false;
  subscriptions.set(userId, (subscriptions.get(userId) ?? 0) + 1);
  const listener = DeviceEventEmitter.addListener('MEMBER_PRESENCE', event => {
    if (event.userId !== userId) return;
    receivedEvent = true;
    callback(event.online === true);
  });
  DeviceEventEmitter.emit('PRESENCE_SUBSCRIPTIONS_CHANGED');
  post<Record<string, unknown>>('/presence/bulk/', { user_ids: [userId] })
    .then(data => {
      if (active && !receivedEvent) callback(data[userId] === 'ONLINE');
    })
    .catch(() => { if (active && !receivedEvent) callback(false); });
  return () => {
    active = false;
    listener.remove();
    const remaining = (subscriptions.get(userId) ?? 1) - 1;
    if (remaining > 0) subscriptions.set(userId, remaining);
    else subscriptions.delete(userId);
    DeviceEventEmitter.emit('PRESENCE_SUBSCRIPTIONS_CHANGED');
  };
}
