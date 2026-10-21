import { Message } from '../types/models';

export function confirmedDelivery(raw: any): Message['deliveryStatus'] {
  if (raw?.is_read === true || (typeof raw?.read_at === 'string' && Number.isFinite(Date.parse(raw.read_at)))) return 'read';
  if (raw?.is_delivered === true || (typeof raw?.delivered_at === 'string' && Number.isFinite(Date.parse(raw.delivered_at)))) return 'delivered';
  return 'sent';
}

export function failureDelivery(error: any, requestStarted: boolean): 'failed' | 'unconfirmed' {
  // A server/network failure can happen after persistence. Retrying blindly may
  // duplicate the message on servers without idempotency support.
  return !requestStarted || (error?.status >= 400 && error?.status < 500 && error?.status !== 408)
    ? 'failed' : 'unconfirmed';
}
export function deliveryLabel(message: Message): string {
  switch (message.deliveryStatus) {
    case 'sending': return 'Sending…';
    case 'failed': return 'Not sent';
    case 'unconfirmed': return 'Delivery unconfirmed';
    case 'read': return 'Read';
    case 'delivered': return 'Delivered';
    default: return 'Sent';
  }
}
export function restoreMessageDelivery(rows: Record<string, Message[]>): Record<string, Message[]> {
  return Object.fromEntries(Object.entries(rows).map(([id, messages]) => [id, messages.map(message =>
    message.deliveryStatus === 'sending' ? { ...message, deliveryStatus: 'unconfirmed' as const } : message)]));
}
