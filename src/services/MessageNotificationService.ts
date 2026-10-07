import { DeviceEventEmitter } from 'react-native';
/** Decrypt-before-display pipeline shared by foreground and headless FCM work. */
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMessages } from '../api/chatService';
import { getChatContentPreview } from '../utils/chatContent';
import { E2EE_DECRYPT_FAILED,smartDecryptText } from '../utils/crypto';
import { getUserIds } from '../utils/keychain';
import {
getActiveChatId,
isMessageNotified,
isSelfUserId,
recordMessageNotified,
} from '../utils/notificationTracker';
import { StorageKeys,accountStorageKey } from '../utils/storage';
import { waitForMessagingCryptoReady } from './MessagingCryptoLifecycle';
import { displayNotification } from './PushNotificationService';

const PROCESSED_PUSHES_KEY = '@mdp/processed_message_pushes_v1';
const MAX_PROCESSED_PUSHES = 200;
const inFlight = new Set<string>();

type PushData = Record<string, string | undefined>;
type MessageMaterial = {
  id?: string;
  ciphertext?: string;
  senderId?: string;
  receiverId?: string;
  conversationId?: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function dataOf(remoteMessage: any): PushData {
  return (remoteMessage?.data ?? {}) as PushData;
}

function extractMaterial(remoteMessage: any): MessageMaterial {
  const data = dataOf(remoteMessage);
  return {
    id:
      stringValue(data.message_id) ??
      stringValue(data.id) ??
      stringValue(remoteMessage?.messageId),
    ciphertext:
      stringValue(data.encrypted_text) ??
      stringValue(data.message) ??
      stringValue(data.text),
    senderId: stringValue(data.sender_id) ?? stringValue(data.senderId),
    receiverId: stringValue(data.receiver_id) ?? stringValue(data.receiverId),
    conversationId:
      stringValue(data.conversation_id) ??
      stringValue(data.conversationId) ??
      stringValue(data.chat_id),
  };
}

async function wasProcessed(id: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_PUSHES_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(id);
  } catch {
    return false;
  }
}

async function markProcessed(id: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(PROCESSED_PUSHES_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [id, ...ids.filter(value => value !== id)].slice(
      0,
      MAX_PROCESSED_PUSHES,
    );
    await AsyncStorage.setItem(PROCESSED_PUSHES_KEY, JSON.stringify(next));
  } catch {
    // Notifee still receives the message ID, so it updates the existing
    // notification even if the persistent dedupe cache is unavailable.
  }
}

/** Resolve missing sender/receiver/ciphertext from the authenticated message API. */
async function hydrateMaterial(
  material: MessageMaterial,
  myMemberId: string,
): Promise<MessageMaterial> {
  if (
    !material.conversationId ||
    !material.id ||
    (material.ciphertext && material.senderId && material.receiverId)
  ) {
    return material;
  }
  try {
    const rows = await getMessages(
      material.conversationId,
      myMemberId,
      material.senderId ?? '',
    );
    const message = rows.find(row => String(row.id) === String(material.id));
    // getMessages maps/decrypts text, so only use it as a last compatibility path.
    // Normal production pushes must carry the encrypted payload plus both IDs.
    if (message && message.text !== E2EE_DECRYPT_FAILED) {
      return {
        ...material,
        ciphertext: message.text,
        senderId: message.senderId,
        receiverId: myMemberId,
      };
    }
  } catch {
    // A push can arrive before networking is available; the encrypted payload path
    // still works without a network request.
  }
  return material;
}

function fallbackBody(remoteMessage: any): string {
  // A legacy notification-only push cannot be decrypted because it has no
  // ciphertext. Its body is used only when it is not an E2EE wire payload;
  // otherwise retain the privacy-safe locked preview.
  const remoteBody = stringValue(remoteMessage?.notification?.body);
  if (
    remoteBody &&
    !remoteBody.includes('__E2EE__:') &&
    !remoteBody.includes('_E2EE_') &&
    !remoteBody.includes('"ct":')
  ) {
    return remoteBody;
  }
  return 'You have a new message';
}

/** Resolve the title locally so a slow/offline API cannot delay the banner. */
function resolveMessageTitle(remoteMessage: any): string {
  const data = dataOf(remoteMessage);
  const name = stringValue(data.sender_name) ?? stringValue(data.senderName);
  return name
    ? name
    : stringValue(data.title) ??
        stringValue(remoteMessage?.notification?.title) ??
        'MyDearPartner';
}

/**
 * Handles data-only FCM chat pushes. It does not create a notification until
 * identity restoration and decryption have completed. A locked preview is only
 * used for logged-out, malformed, privacy-disabled, or truly undecryptable data.
 */
export async function handleIncomingMessagePush(
  remoteMessage: any,
  isForeground: boolean = false,
): Promise<void> {
  
  const material = extractMaterial(remoteMessage);

  try {
    const userIds = await getUserIds();
    const accountId = userIds?.memberId;
    const raw = accountId
      ? await AsyncStorage.getItem(
          accountStorageKey(StorageKeys.MUTED_USERS, accountId),
        )
      : null;
    const muted: string[] = raw ? JSON.parse(raw) : [];
    if (
      (material.senderId && muted.includes(material.senderId)) ||
      (material.conversationId && muted.includes(material.conversationId))
    ) {
      
      return;
    }
  } catch {
    // Best effort check
  }

  const dedupeId = material.id;
  if (dedupeId) {
    if (
      inFlight.has(dedupeId) ||
      isMessageNotified(dedupeId) ||
      (await wasProcessed(dedupeId))
    )
      return;

    // Strengthen deduplication using Notifee
    if (!isForeground) {
      try {
        const displayed = await notifee.getDisplayedNotifications();
        if (displayed.some(n => n.id === dedupeId)) {
          
          return;
        }
      } catch {
        // ignore
      }
    }

    // Another callback may have completed the asynchronous checks concurrently.
    if (inFlight.has(dedupeId) || isMessageNotified(dedupeId)) return;
    inFlight.add(dedupeId);
  }

  try {
    const rawData = dataOf(remoteMessage);
    const rawSender =
      material.senderId ||
      rawData.sender_id ||
      rawData.senderId ||
      rawData.sender ||
      rawData.user_id ||
      rawData.from_user_id ||
      rawData.from_id;

    if (isSelfUserId(rawSender)) {
      
      return;
    }

    const userIds = await getUserIds();
    const myMemberId = await waitForMessagingCryptoReady();
    // Stored IDs alone do not prove that this task belongs to an active session.
    // A delayed push for another account must not expose its message preview.
    if (material.receiverId && myMemberId &&
        material.receiverId !== myMemberId && material.receiverId !== userIds?.profileId) return;
    const myProfileId = userIds?.profileId;

    const senderId = material.senderId;

    const isSelfMessage =
      Boolean(
        myMemberId &&
          (String(senderId) === String(myMemberId) ||
            String(rawSender) === String(myMemberId)),
      ) ||
      Boolean(
        myProfileId &&
          (String(senderId) === String(myProfileId) ||
            String(rawSender) === String(myProfileId)),
      );

    if (isSelfMessage) {
      
      return;
    }

    let body = myMemberId ? fallbackBody(remoteMessage) : 'You have a new message';
    let resolved = material;

    const previewsDisabled =
      stringValue(dataOf(remoteMessage).preview_disabled) === 'true';
    if (myMemberId && !previewsDisabled) {
      resolved = await hydrateMaterial(material, myMemberId);
      if (resolved.ciphertext) {
        let plaintext = await smartDecryptText(
          resolved.ciphertext,
          myMemberId,
          resolved.senderId,
          resolved.conversationId,
          resolved.senderId,
          resolved.receiverId,
        );
        // One bounded recovery attempt handles a Keychain/native-crypto module
        // that became available while this headless task was being started.
        if (plaintext === E2EE_DECRYPT_FAILED) {
          await waitForMessagingCryptoReady();
          plaintext = await smartDecryptText(
            resolved.ciphertext,
            myMemberId,
            resolved.senderId,
            resolved.conversationId,
            resolved.senderId,
            resolved.receiverId,
          );
        }
        if (
          plaintext &&
          plaintext !== E2EE_DECRYPT_FAILED &&
          !plaintext.startsWith('__E2EE__:')
        ) {
          body = getChatContentPreview(plaintext);
        }
      }
    }

    if (myMemberId && await waitForMessagingCryptoReady() !== myMemberId) return;
    const data = dataOf(remoteMessage);
    const title = resolveMessageTitle(remoteMessage);

    if (
      isForeground &&
      resolved.conversationId &&
      String(getActiveChatId()) === String(resolved.conversationId)
    ) {
      
      DeviceEventEmitter.emit('REFRESH_ACTIVE_CHAT', resolved.conversationId);
      if (dedupeId) {
        recordMessageNotified(dedupeId);
        await markProcessed(dedupeId);
      }
      return;
    }

    // Foreground remote alerts are not presented by Firebase by default.
    // Use the same local display path for alert and data-only chat pushes;
    // IncomingPushService already skips OS-rendered background alerts.
    const displayed = await displayNotification(
      title,
      body,
      data,
      dedupeId,
      'mdp_messages_v2',
    );
    if (!displayed) return;

    if (dedupeId) {
      recordMessageNotified(dedupeId);
      await markProcessed(dedupeId);
    }
  } finally {
    if (dedupeId) inFlight.delete(dedupeId);
  }
}
