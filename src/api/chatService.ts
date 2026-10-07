/**
 * MyDearPartner — Chat Service
 *
 * REST polling layer for chat data.
 * Backend: https://mydearpartner.in/api/v1/
 * WebSocket: wss://mydearpartner.in/ws/  (handled in wsClient.ts)
 *
 * Expected URL patterns:
 *   GET    /api/v1/conversations/                       → Chat[]
 *   POST   /api/v1/conversations/                       → Chat (create or get)
 *   GET    /api/v1/conversations/{id}/messages/          → PaginatedResponse<Message>
 *   POST   /api/v1/conversations/{id}/messages/          → Message
 *
 *  NOTE: /api/v1/chats/ does NOT exist on the backend (returns 404).
 *        The real endpoint is /conversations/.
 */

import { Chat,Message } from '../types/models';
import { smartDecryptText } from '../utils/crypto';
import { get,post } from './apiClient';
import { mapProfile } from './profileService';
import { BackendChat,BackendMessage } from './types';

/** Map backend chat to iOS Chat model (decrypts the last-message preview). */
async function mapChat(bc: BackendChat, myId: string): Promise<Chat> {
  if (!bc || typeof bc !== 'object' || !bc.id) throw new Error('Could not load the conversation. Please try again.');
  const raw = bc as any;
  const partnerId = String(
    bc.partner_id ?? raw.partnerId ?? raw.other_profile_id ?? '',
  );
  const partnerMemberId = bc.profile?.user_id;
  const cryptoPartnerId = partnerMemberId || partnerId;
  const wireLastMessage =
    bc.lastMessage ?? raw.last_message ?? raw.last_message_text ?? raw.message;
  let lastMessage = await smartDecryptText(
    wireLastMessage,
    myId,
    cryptoPartnerId,
    bc.id,
  );
  // Graceful fallback for messages while decrypting or loading on mobile
  if (
    !lastMessage ||
    lastMessage.startsWith('__E2EE__:') ||
    lastMessage === '🔒 Encrypted message'
  ) {
    lastMessage = wireLastMessage ? 'Message unavailable' : '';
  }

  const lastSenderId =
    raw.last_message_sender_id ||
    raw.last_sender_id ||
    raw.lastMessageSenderId ||
    raw.last_message?.sender_id ||
    raw.lastMessage?.sender_id;

  return {
    id: String(bc.id),
    participantIds: [partnerId, 'CURRENT_USER_PLACEHOLDER'],
    lastMessage,
    lastMessageAt:
      bc.time || raw.last_message_at || raw.lastMessageAt || raw.updated_at
        ? new Date(
            bc.time ||
              raw.last_message_at ||
              raw.lastMessageAt ||
              raw.updated_at,
          ).getTime()
        : undefined,
    lastSenderId: lastSenderId ? String(lastSenderId) : undefined,
    otherProfile: bc.profile ? mapProfile(bc.profile) : undefined,
    unreadCount: Math.max(0, Number(raw.unread_count ?? raw.unread_messages_count ?? raw.unread) || 0),
  };
}

/** Map backend message to iOS Message model (decrypts text). */
async function mapMessage(
  bm: BackendMessage,
  myId: string,
  partnerId: string,
  conversationId?: string,
): Promise<Message> {
  // sender_id / receiver_id are the MEMBER (account) ids — their sorted pair is
  // the exact seed the web client used, so decryption works even when the
  // app-context partner id hasn't been resolved yet.
  let text = await smartDecryptText(
    bm.text,
    myId,
    partnerId,
    conversationId,
    bm.sender_id,
    bm.receiver_id,
  );
  // Graceful fallback for messages while decrypting or loading on mobile
  if (
    !text ||
    text.startsWith('__E2EE__:') ||
    text === '🔒 Encrypted message'
  ) {
    text = 'Message unavailable';
  }

  return {
    id: String(bm.id),
    chatId: bm.chat_id ?? (bm as any).conversation_id,
    senderId: String(bm.sender_id),
    text,
    createdAt: new Date(bm.created_at).getTime(),
  };
}

/**
 * Backend responses come wrapped differently per endpoint:
 *   - plain array
 *   - { results: [...] }                    (DRF pagination)
 *   - { data: [...] }
 *   - { success, data: { messages: [...] } } (this backend's message envelope)
 *   - { success, data: { conversations:[..]}}
 */
function extractResults<T>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.messages)) return data.messages;
  if (Array.isArray(data?.chats)) return data.chats;
  if (Array.isArray(data?.conversations)) return data.conversations;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.messages)) return data.data.messages;
  if (Array.isArray(data?.data?.conversations)) return data.data.conversations;
  if (Array.isArray(data?.data?.chats)) return data.data.chats;
  if (Array.isArray(data?.data?.results)) return data.data.results;
  return [];
}

/**
 * Get all chats for the current user.
 */
export async function getChats(myId: string): Promise<Chat[]> {
  const data = await get<any>('/conversations/');

  const rows = extractResults<BackendChat>(data).filter(row => row && typeof row === 'object' && row.id);
  
  return Promise.all(rows.map(row => mapChat(row, myId)));
}

/**
 * Get or create a chat with another user.
 */
export async function getOrCreateChat(
  otherProfileId: string,
  myId: string,
  otherUserId?: string,
): Promise<Chat> {
  const data = await post<any>('/conversations/', {
    partner_id: otherUserId || otherProfileId,
  });

  const chat = data?.data ?? data;
  return mapChat(chat, myId);
}

/**
 * Get messages for a chat (most recent page) — decrypts each message.
 */
export async function getMessages(
  chatId: string,
  myId: string,
  partnerId: string,
): Promise<Message[]> {
  const target = partnerId || chatId;
  let data;
  try {
    data = await get<any>(`/conversations/${target}/messages/`);
  } catch (err: any) {
    if ([404, 405].includes(err?.status) && target !== chatId) {
      data = await get<any>(`/conversations/${chatId}/messages/`);
    } else {
      throw err;
    }
  }
  const rows = extractResults<BackendMessage>(data).filter(row => row && typeof row === 'object' && row.id &&
    row.sender_id && Number.isFinite(new Date(row.created_at).getTime()));
  return Promise.all(rows.map(row => mapMessage(row, myId, partnerId, chatId)));
}

/**
 * Send a message via REST (fallback if WebSocket is unavailable).
 * text must be prepared using the server's messaging security contract.
 * Returns the saved message with its RAW wire text — the caller decrypts it
 * with the correct user/partner key (see AppDataContext.sendMessage).
 */
export async function sendMessage(
  chatId: string,
  text: string,
  partnerId?: string,
): Promise<Message> {
  // The deployed API identifies the recipient by member/account ID, while
  // chatId identifies the local conversation used to display the response.
  const target = partnerId || chatId;
  const data = await post<any>(`/conversations/${target}/messages/`, {
    text: text,
  });
  const saved = data?.data ?? data;
  if (!saved?.id || !saved?.sender_id || !Number.isFinite(new Date(saved.created_at).getTime())) {
    throw new Error('Message confirmation was incomplete. Refresh the conversation before trying again.');
  }
  return {
    id: String(saved.id),
    chatId: saved.chat_id ?? (saved as any).conversation_id,
    senderId: String(saved.sender_id),
    text: saved.text,
    createdAt: new Date(saved.created_at).getTime(),
  };
}

/**
 * Mark all messages in a conversation as read.
 * Sends POST /conversations/<id>/mark-read/ to update is_read and clear alerts.
 */
export async function markAsRead(
  chatId: string,
  partnerId?: string,
): Promise<void> {
  const target = partnerId || chatId;
  try {
    await post<any>(`/conversations/${target}/mark-read/`, {});
  } catch (error: any) {
    // Only an absent legacy route warrants another write.
    if ([404, 405].includes(error?.status) && partnerId && partnerId !== chatId) {
      try {
        await post<any>(`/conversations/${chatId}/mark-read/`, {});
      } catch {
        // Best effort
      }
    }
  }
}
