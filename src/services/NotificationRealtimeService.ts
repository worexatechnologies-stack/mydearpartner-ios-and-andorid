import { AppState,DeviceEventEmitter } from 'react-native';
import { WS_BASE_URL } from '../config/env';
import { loadTokens } from '../utils/keychain';
import { interestEventKind, notifyInterest } from './InterestNotificationService';
import { handleIncomingPush } from './IncomingPushService';
import { presenceUserIds } from './PresenceService';

export async function handleRealtimeNotification(event: any) {
  if (event.type === 'presence.changed') {
    DeviceEventEmitter.emit('MEMBER_PRESENCE', { userId: event.user_id, online: event.status === 'ONLINE' });
    return;
  }
  if (event.type === 'presence.snapshot') {
    const statuses = event.data?.statuses ?? {};
    for (const userId of presenceUserIds()) {
      DeviceEventEmitter.emit('MEMBER_PRESENCE', { userId, online: statuses[userId] === 'ONLINE' });
    }
    return;
  }
  if (event.type === 'privacy.updated') {
    DeviceEventEmitter.emit('PRIVACY_SETTINGS_CHANGED');
    DeviceEventEmitter.emit('REFRESH_APP_DATA');
    return;
  }
  const data = {
    ...event.data,
    kind: event.data?.kind ?? event.data?.notification_type ?? event.notification_type ?? event.type,
  };
  const notificationType = event.notification_type ?? data.notification_type ?? event.type;
  if (notificationType === 'MATCH_REMOVED' || data.kind === 'MATCH_REMOVED' || event.type === 'match.removed') {
    DeviceEventEmitter.emit('REFRESH_INTERESTS');
    DeviceEventEmitter.emit('REFRESH_CHATS');
    // Refresh the open thread so its server denial can disable the composer.
    DeviceEventEmitter.emit('REFRESH_ACTIVE_CHAT');
    return;
  }
  const kind = interestEventKind(data, event.notification_type ?? '');

  if (kind) {
    DeviceEventEmitter.emit('REFRESH_INTERESTS');
    DeviceEventEmitter.emit('REFRESH_APP_DATA');
    await notifyInterest({
      id: String(data.interest_id ?? data.interestId ?? event.entity_id ?? '') || undefined,
      kind,
      senderName: data.sender_name ?? data.senderName,
      profileId: data.profile_id ?? data.sender_profile_id ?? data.sender_id,
      data,
    }, true);
    return;
  }

  const chatKind = String(data.kind).toLowerCase();
  const isChat =
    chatKind === 'chat_message' ||
    chatKind === 'chat.message' ||
    chatKind === 'message' ||
    Boolean(data.encrypted_text) ||
    Boolean(data.message_id) ||
    Boolean(data.conversation_id) ||
    Boolean(data.chat_id) ||
    event.type === 'chat_message' ||
    event.type === 'message';

  if (isChat) {
    DeviceEventEmitter.emit('REFRESH_CHATS');
    DeviceEventEmitter.emit('REFRESH_APP_DATA');
    const conversationId =
      data.conversation_id || data.chat_id || data.conversationId;
    if (conversationId) {
      DeviceEventEmitter.emit('REFRESH_ACTIVE_CHAT', conversationId);
    }
    const messageId =
      data.message_id ||
      data.messageId ||
      data.id ||
      event.message_id ||
      event.messageId ||
      event.entity_id ||
      event.id;

    if (messageId) {
      await handleIncomingPush(
        {
          data: {
            ...data,
            conversation_id: conversationId,
            message_id: String(messageId),
            kind: 'chat_message',
          },
        },
        true,
      );
    }
    return;
  }

  if (event.type === 'notification.created') {
    DeviceEventEmitter.emit('REFRESH_INTERESTS');
  }
}

/** One authenticated socket per signed-in session; FCM remains the background transport. */
export function startNotificationRealtime(): () => void {
  let disposed = false;
  let generation = 0;
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let attempts = 0;
  let connectTimeout: ReturnType<typeof setTimeout> | undefined;
  let lastFrame = Date.now();
  const sendSubscriptions = () => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'presence.subscribe', user_ids: presenceUserIds() }));
    }
  };
  const presenceSubscription = DeviceEventEmitter.addListener('PRESENCE_SUBSCRIPTIONS_CHANGED', sendSubscriptions);
  const close = () => {
    for (const userId of presenceUserIds()) {
      DeviceEventEmitter.emit('MEMBER_PRESENCE', { userId, online: false });
    }
    generation += 1;
    clearTimeout(retry);
    clearInterval(heartbeat);
    clearTimeout(connectTimeout);
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      socket.close();
      socket = null;
    }
  };
  const schedule = () => {
    if (disposed || AppState.currentState !== 'active') return;
    clearTimeout(retry);
    retry = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30000));
  };
  const connect = async () => {
    close();
    const revision = generation;
    try {
      const tokens = await loadTokens();
      if (
        disposed ||
        revision !== generation ||
        AppState.currentState !== 'active' ||
        !tokens?.accessToken
      )
        return;
      const ws = new WebSocket(`${WS_BASE_URL}notifications/`, [
        'access_token',
        tokens.accessToken,
      ]);
      socket = ws;
      connectTimeout = setTimeout(() => ws.close(), 12000);
      ws.onopen = () => {
        clearTimeout(connectTimeout);
        lastFrame = Date.now();
        attempts = 0;
        sendSubscriptions();
        DeviceEventEmitter.emit('REFRESH_INTERESTS');
        heartbeat = setInterval(() => {
          if (Date.now() - lastFrame > 60000) {
            ws.close();
            return;
          }
          if (ws.readyState === WebSocket.OPEN)
            ws.send(JSON.stringify({ type: 'heartbeat' }));
        }, 25000);
      };
      ws.onmessage = event => {
        lastFrame = Date.now();
        try {
          handleRealtimeNotification(JSON.parse(event.data)).catch(error =>
            console.warn('[Realtime] Notification failed:', error),
          );
        } catch {
          /* Ignore malformed or non-JSON frames. */
        }
      };
      ws.onclose = () => {
        clearTimeout(connectTimeout);
        clearInterval(heartbeat);
        schedule();
      };
      ws.onerror = () => ws.close();
    } catch {
      schedule();
    }
  };
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') {
      attempts = 0;
      connect();
    } else close();
  });
  connect();
  return () => {
    disposed = true;
    subscription.remove();
    presenceSubscription.remove();
    close();
  };
}
