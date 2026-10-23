import { verifySessionRevocation } from './SessionRevocationService';
import { DeviceEventEmitter } from 'react-native';
import { getUserIds } from '../utils/keychain';
import { getActiveChatId,isSelfUserId } from '../utils/notificationTracker';
import { StorageKeys,accountStorageKey,getItem } from '../utils/storage';
import {
interestEventKind,
notifyInterest,
} from './InterestNotificationService';
import { handleIncomingMessagePush } from './MessageNotificationService';
import { displayNotification } from './PushNotificationService';
import { savedSearchIdFromNotification } from '../utils/savedSearchNotification';
import { navigateToSavedSearch } from '../navigation/navigationRef';
import { showInAppNotification } from '../utils/notifications';

const savedAlertDisplays = new Map<string, number>();

function value(data: any, key: string): string | undefined {
  const candidate = data?.[key];
  if (candidate === null || candidate === undefined) return undefined;
  if (typeof candidate === 'number') return String(candidate);
  return typeof candidate === 'string' && candidate.trim().length > 0
    ? candidate.trim()
    : undefined;
}

/** Handles both foreground and headless FCM events with robust type classification. */
export async function handleIncomingPush(
  remoteMessage: any,
  isForeground: boolean = false,
): Promise<void> {
  const data = remoteMessage?.data ?? {};
  // When the server includes a visible notification payload, Android/iOS
  // render it themselves while the app is backgrounded or terminated. Do not
  // create a second Notifee notification from a background callback.
  const systemRendered =
    !isForeground &&
    Boolean(
      remoteMessage?.notification?.title || remoteMessage?.notification?.body,
    );
  const kind = (
    value(data, 'kind') ??
    value(data, 'type') ??
    value(data, 'notification_type') ??
    ''
  ).toLowerCase();
  if (kind === 'session_replaced') {
    const revoked = await verifySessionRevocation(data);
    if (revoked && !systemRendered && !isForeground) {
      await displayNotification('Signed out', 'Your account was signed in on another device. You have been logged out.',
        { kind: 'session_replaced' }, remoteMessage?.messageId);
    }
    return;
  }
  const notifTitle = (remoteMessage?.notification?.title ?? '').toLowerCase();
  if (String(data.notification_type ?? kind).toUpperCase() === 'SAVED_SEARCH_MATCH') {
    const userIds = await getUserIds().catch(() => null);
    const accountId = userIds?.memberId ?? userIds?.profileId;
    if (!accountId || (data.receiver_id && data.receiver_id !== userIds?.memberId && data.receiver_id !== userIds?.profileId)) return;
    DeviceEventEmitter.emit('REFRESH_SAVED_SEARCH_ALERTS');
    const searchId = savedSearchIdFromNotification(data);
    const alertId = data.notification_id ?? data.id ?? remoteMessage?.messageId;
    if (alertId) {
      const key = `${accountId}:${alertId}`;
      const now = Date.now();
      if (savedAlertDisplays.has(key) && now - savedAlertDisplays.get(key)! < 60000) return;
      savedAlertDisplays.set(key, now);
      if (savedAlertDisplays.size > 200) savedAlertDisplays.delete(savedAlertDisplays.keys().next().value!);
    }
    if (!systemRendered) {
      if (isForeground) showInAppNotification({
        title: 'New matching profiles', message: 'Open your saved search to see new matches.',
        type: 'system', icon: 'bookmark', onPress: searchId ? () => navigateToSavedSearch(searchId) : undefined,
      });
      else await displayNotification('New matching profiles', 'Open your saved search to see new matches.', data, alertId);
    }
    return;
  }
  const notifBody = (remoteMessage?.notification?.body ?? '').toLowerCase();

  const hasChatData =
    kind === 'chat_message' ||
    kind === 'chat.message' ||
    kind === 'message' ||
    kind.includes('chat') ||
    kind.includes('message') ||
    Boolean(data.encrypted_text) ||
    Boolean(data.message_id) ||
    Boolean(data.messageId) ||
    Boolean(data.conversation_id) ||
    Boolean(data.conversationId) ||
    Boolean(data.chat_id) ||
    Boolean(data.chatId);

  // Explicit chat fields take precedence over words in the message preview
  // (for example, "I like your profile" is still a chat message).
  const interestKind =
    interestEventKind(data) ??
    (hasChatData ? null : interestEventKind(data, `${notifTitle} ${notifBody}`));
  if (interestKind) {
    if (systemRendered) return;
    await notifyInterest(
      {
        id:
          String(
            data.interest_id ??
              data.interestId ??
              data.id ??
              remoteMessage?.messageId ??
              '',
          ) || undefined,
        kind: interestKind,
        senderName:
          value(data, 'sender_name') ??
          value(data, 'senderName') ??
          value(data, 'name'),
        profileId:
          value(data, 'profile_id') ??
          value(data, 'sender_profile_id') ??
          value(data, 'sender_id'),
        avatarUrl: value(data, 'avatar_url') ?? value(data, 'photo_url'),
        data,
      },
      isForeground,
    );
    return;
  }

  // 2. Handle Chat Notifications
  const isChat =
    hasChatData ||
    Boolean(
      remoteMessage?.notification?.title || remoteMessage?.notification?.body,
    );

  if (isChat) {
    // Instantly notify active screens to refresh chat list and badge counts
    DeviceEventEmitter.emit('REFRESH_CHATS');
    DeviceEventEmitter.emit('REFRESH_APP_DATA');

    const senderId =
      value(data, 'sender_id') ??
      value(data, 'senderId') ??
      value(data, 'sender') ??
      value(data, 'profile_id') ??
      value(data, 'user_id') ??
      value(data, 'from_user_id') ??
      value(data, 'from_id');
    const conversationId =
      value(data, 'conversation_id') ??
      value(data, 'conversationId') ??
      value(data, 'chat_id') ??
      value(data, 'chatId');

    if (
      isForeground &&
      conversationId &&
      String(getActiveChatId()) === String(conversationId)
    ) {
      DeviceEventEmitter.emit('REFRESH_ACTIVE_CHAT', conversationId);
      return;
    }

    // Synchronous memory check first (0ms latency, eliminates race condition)
    if (isSelfUserId(senderId)) {
      return;
    }

    try {
      const userIds = await getUserIds();
      if (
        (userIds?.memberId &&
          senderId &&
          String(senderId) === String(userIds.memberId)) ||
        (userIds?.profileId &&
          senderId &&
          String(senderId) === String(userIds.profileId))
      ) {
        return;
      }
      const muted = userIds?.memberId
        ? await getItem<string[]>(
            accountStorageKey(StorageKeys.MUTED_USERS, userIds.memberId),
          )
        : null;
      if (muted && Array.isArray(muted)) {
        if (
          (senderId && muted.includes(senderId)) ||
          (conversationId && muted.includes(conversationId))
        ) {
          return;
        }
      }
    } catch {
      // Best effort check
    }

    if (systemRendered) {
      return;
    }

    await handleIncomingMessagePush(remoteMessage, isForeground);
    return;
  }

  if (systemRendered) return;

  // Fallback for any other push notification:
  if (remoteMessage?.notification?.title) {
    await displayNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body ?? '',
      data,
      remoteMessage.messageId,
    );
  }
}
