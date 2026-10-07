/**
 * MyDearPartner — WebSocket Client
 *
 * Connects to the Django Channels WebSocket at:
 * wss://mydearpartner.in/ws/chat/{roomId}/
 */

import {
WS_MAX_RECONNECT_ATTEMPTS,
WS_RECONNECT_DELAY_MS,
} from '../config/constants';
import { WS_BASE_URL } from '../config/env';
import { loadTokens } from '../utils/keychain';

export type WsMessageCallback = (message: {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: number;
}) => void;

export type WsStatusCallback = (
  status: 'connected' | 'disconnected' | 'error',
) => void;

class ChatWebSocket {
  private ws: any = null;
  private generation = 0;
  private chatId: string | null = null;
  private partnerId: string | null = null;
  private usePartnerRoute = true;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageCallback: WsMessageCallback | null = null;
  private statusCallback: WsStatusCallback | null = null;
  private typingCallback: ((isTyping: boolean) => void) | null = null;
  private presenceCallback: ((isOnline: boolean) => void) | null = null;
  private shouldReconnect = true;

  async connect(
    chatId: string,
    onMessage: WsMessageCallback,
    onStatus?: WsStatusCallback,
    onTyping?: (isTyping: boolean) => void,
    onPresence?: (isOnline: boolean) => void,
    partnerId?: string,
  ): Promise<void> {
    this.disconnect();
    this.chatId = chatId;
    this.partnerId = partnerId || null;
    this.usePartnerRoute = Boolean(partnerId && partnerId !== chatId);
    this.messageCallback = onMessage;
    this.statusCallback = onStatus ?? null;
    this.typingCallback = onTyping ?? null;
    this.presenceCallback = onPresence ?? null;
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    await this._connect();
  }

  private async _connect(): Promise<void> {
    if (!this.chatId || !this.shouldReconnect) return;
    const generation = this.generation;
    const stored = await loadTokens();
    if (generation !== this.generation || !this.shouldReconnect) return;
    const token = stored?.accessToken ?? '';
    const target =
      this.usePartnerRoute && this.partnerId ? this.partnerId : this.chatId;
    const url = `${WS_BASE_URL}chat/${target}/?token=${encodeURIComponent(
      token,
    )}`;

    

    try {
      // Subprotocol authentication as required by Daphne / Django Channels
      if (token) {
        this.ws = new WebSocket(url, ['access_token', token]);
      } else {
        this.ws = new WebSocket(url);
      }
    } catch {
      try {
        this.ws = new WebSocket(url);
      } catch {
        this.statusCallback?.('error');
        this._scheduleReconnect();
        return;
      }
    }

    if (!this.ws) return;

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.statusCallback?.('connected');
      
      // Announce online presence to room
      this.sendPresence(true);
    };

    this.ws.onmessage = (event: any) => {
      try {
        const data = JSON.parse(event.data);

        // Typing indicator
        if (data.type === 'typing') {
          const isTyping = Boolean(data.isTyping ?? data.typing);
          
          this.typingCallback?.(isTyping);
          return;
        }

        // Presence / online status
        if (
          data.type === 'presence' ||
          data.type === 'user_status' ||
          data.type === 'online' ||
          data.type === 'user_online' ||
          data.isOnline !== undefined ||
          data.status === 'online' ||
          data.status === 'offline'
        ) {
          const isOnline =
            data.isOnline !== undefined
              ? Boolean(data.isOnline)
              : data.status === 'online' ||
                data.type === 'online' ||
                data.type === 'user_online';
          this.presenceCallback?.(isOnline);
          return;
        }

        // Chat message
        if (
          data.type === 'chat_message' ||
          data.type === 'message' ||
          data.message ||
          data.text
        ) {
          const msg =
            data.message && typeof data.message === 'object'
              ? data.message
              : data;
          const text = msg.text ?? msg.message;
          if (typeof text !== 'string') return;

          this.messageCallback?.({
            id: msg.id ?? String(Date.now()),
            chatId: this.chatId!,
            senderId:
              msg.sender_id ?? msg.senderId ?? msg.sender ?? msg.user_id,
            text: text,
            createdAt: msg.created_at
              ? new Date(msg.created_at).getTime()
              : Date.now(),
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      
      this.statusCallback?.('error');
    };

    this.ws.onclose = (event: any) => {
      
      this.statusCallback?.('disconnected');
      // If closing with partner route on first try, fall back to chatId route
      if (this.usePartnerRoute && this.reconnectAttempts === 0) {
        this.usePartnerRoute = false;
        this._connect().catch(console.error);
        return;
      }
      if (this.shouldReconnect && (!event || !event.wasClean)) {
        this._scheduleReconnect();
      }
    };
  }

  private _scheduleReconnect(): void {
    if (
      !this.shouldReconnect ||
      this.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS
    ) {
      return;
    }
    const delay = WS_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this._connect().catch(console.error);
    }, delay);
  }

  sendMessage(text: string): boolean {
    if (this.ws && this.ws.readyState === 1 /* WebSocket.OPEN */) {
      try {
        this.ws.send(JSON.stringify({ text, message: text }));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  sendTyping(isTyping: boolean): boolean {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(
          JSON.stringify({ type: 'typing', isTyping, typing: isTyping }),
        );
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  sendPresence(isOnline: boolean): boolean {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(
          JSON.stringify({
            type: 'presence',
            isOnline,
            status: isOnline ? 'online' : 'offline',
          }),
        );
        return true;
      } catch {
        // Best effort
      }
    }
    return false;
  }

  sendReadReceipt(): boolean {
    if (this.ws && this.ws.readyState === 1) {
      try {
        this.ws.send(JSON.stringify({ type: 'read', is_read: true }));
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.generation += 1;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      try {
        this.ws.close(1000, 'Client disconnected');
      } catch {
        // Ignore close error
      }
      this.ws = null;
    }
  }

  get isConnected(): boolean {
    return this.ws && this.ws.readyState === 1;
  }
}

export const chatWsClient = new ChatWebSocket();
