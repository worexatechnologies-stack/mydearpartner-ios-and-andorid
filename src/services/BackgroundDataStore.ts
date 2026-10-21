import AsyncStorage from '@react-native-async-storage/async-storage';
import { Chat, Interest, Message, Profile } from '../types/models';
import { accountStorageKey, getItem, setItem, StorageKeys } from '../utils/storage';

const MAX_CACHED_MESSAGES_PER_CHAT = 100;
const MAX_CACHED_CHATS = 50;
const MAX_CACHED_PROFILES = 100;

export interface CachedInterests {
  sent: Interest[];
  received: Interest[];
  merged: Interest[];
}

/**
 * Persist incoming chat message to local AsyncStorage in the background or foreground.
 * Runs seamlessly during headless FCM push processing and foreground socket events.
 */
export async function storeBackgroundMessage(
  message: Message,
  accountId: string,
): Promise<void> {
  if (!accountId || !message.chatId || !message.id) return;

  try {
    const messagesKey = accountStorageKey(StorageKeys.MESSAGES, accountId);
    const existingRaw = await AsyncStorage.getItem(messagesKey);
    const messagesMap: Record<string, Message[]> = existingRaw
      ? JSON.parse(existingRaw)
      : {};

    const chatMessages = messagesMap[message.chatId] ?? [];
    const exists = chatMessages.some(m => String(m.id) === String(message.id));

    if (!exists) {
      const updatedMessages = [...chatMessages, message]
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-MAX_CACHED_MESSAGES_PER_CHAT);

      messagesMap[message.chatId] = updatedMessages;
      await AsyncStorage.setItem(messagesKey, JSON.stringify(messagesMap));
    }

    // Update conversation summary in local CHATS cache
    const chatsKey = accountStorageKey(StorageKeys.CHATS, accountId);
    const chatsRaw = await AsyncStorage.getItem(chatsKey);
    if (chatsRaw) {
      const chats: Chat[] = JSON.parse(chatsRaw);
      const chatIndex = chats.findIndex(c => String(c.id) === String(message.chatId));

      if (chatIndex !== -1) {
        const currentChat = chats[chatIndex];
        const isFromMe = String(message.senderId) === String(accountId);
        const updatedChat: Chat = {
          ...currentChat,
          lastMessage: message.text,
          lastMessageAt: message.createdAt,
          lastSenderId: message.senderId,
          unreadCount: isFromMe ? currentChat.unreadCount : (currentChat.unreadCount ?? 0) + 1,
        };

        // Move active chat to the top
        chats.splice(chatIndex, 1);
        chats.unshift(updatedChat);
        await AsyncStorage.setItem(chatsKey, JSON.stringify(chats.slice(0, MAX_CACHED_CHATS)));
      }
    }
  } catch (err) {
    console.warn('[BackgroundDataStore] storeBackgroundMessage failed:', err);
  }
}

/**
 * Persist an interest notification to local AsyncStorage in background or foreground.
 */
export async function storeBackgroundInterest(
  interest: Interest,
  accountId: string,
): Promise<void> {
  if (!accountId || !interest.id) return;

  try {
    const key = accountStorageKey(StorageKeys.INTERESTS, accountId);
    const existing = await getItem<CachedInterests>(key);

    const sent = existing?.sent ? [...existing.sent] : [];
    const received = existing?.received ? [...existing.received] : [];

    const isFromMe = String(interest.fromUserId) === String(accountId);

    if (isFromMe) {
      const idx = sent.findIndex(i => String(i.id) === String(interest.id));
      if (idx !== -1) sent[idx] = interest;
      else sent.unshift(interest);
    } else {
      const idx = received.findIndex(i => String(i.id) === String(interest.id));
      if (idx !== -1) received[idx] = interest;
      else received.unshift(interest);
    }

    const merged = [...sent];
    received.forEach(r => {
      if (!merged.some(m => String(m.id) === String(r.id))) {
        merged.push(r);
      }
    });

    await setItem<CachedInterests>(key, { sent, received, merged });
  } catch (err) {
    console.warn('[BackgroundDataStore] storeBackgroundInterest failed:', err);
  }
}

/**
 * Save snapshot of all discover profiles for 0ms instant app launch.
 */
export async function persistDiscoverProfiles(
  profiles: Profile[],
  accountId: string,
): Promise<void> {
  if (!accountId || !profiles || profiles.length === 0) return;
  try {
    const key = accountStorageKey(StorageKeys.DISCOVER_PROFILES, accountId);
    await setItem<Profile[]>(key, profiles.slice(0, MAX_CACHED_PROFILES));
  } catch (err) {
    console.warn('[BackgroundDataStore] persistDiscoverProfiles failed:', err);
  }
}

/**
 * Save snapshot of chats for 0ms instant conversation list rendering.
 */
export async function persistChats(
  chats: Chat[],
  accountId: string,
): Promise<void> {
  if (!accountId || !chats) return;
  try {
    const key = accountStorageKey(StorageKeys.CHATS, accountId);
    await setItem<Chat[]>(key, chats.slice(0, MAX_CACHED_CHATS));
  } catch (err) {
    console.warn('[BackgroundDataStore] persistChats failed:', err);
  }
}

/**
 * Save snapshot of interests for 0ms instant Activity rendering.
 */
export async function persistInterests(
  interests: CachedInterests,
  accountId: string,
): Promise<void> {
  if (!accountId) return;
  try {
    const key = accountStorageKey(StorageKeys.INTERESTS, accountId);
    await setItem<CachedInterests>(key, interests);
  } catch (err) {
    console.warn('[BackgroundDataStore] persistInterests failed:', err);
  }
}

/**
 * Save snapshot of messages for 0ms instant chat rendering.
 */
export async function persistMessages(
  messages: Record<string, Message[]>,
  accountId: string,
): Promise<void> {
  if (!accountId || !messages) return;
  try {
    const key = accountStorageKey(StorageKeys.MESSAGES, accountId);
    await setItem<Record<string, Message[]>>(key, messages);
  } catch (err) {
    console.warn('[BackgroundDataStore] persistMessages failed:', err);
  }
}

/**
 * Save snapshot of profile cache for instant profile card details.
 */
export async function persistProfileCache(
  cache: Record<string, Profile>,
  accountId: string,
): Promise<void> {
  if (!accountId || !cache) return;
  try {
    const key = accountStorageKey(StorageKeys.PROFILE_CACHE, accountId);
    await setItem<Record<string, Profile>>(key, cache);
  } catch (err) {
    console.warn('[BackgroundDataStore] persistProfileCache failed:', err);
  }
}
