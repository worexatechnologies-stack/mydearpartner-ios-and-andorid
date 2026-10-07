import { DeviceEventEmitter } from 'react-native';
import {
isInterestNotified,
recordInterestNotified,
} from '../utils/notificationTracker';
import {
CHANNEL_ID_INTERESTS,
displayNotification,
} from './PushNotificationService';

export type InterestEventKind =
  | 'interest_received'
  | 'interest_accepted'
  | 'interest_declined'
  | 'interest_withdrawn';
const inFlight = new Set<string>();

export function interestEventKind(
  data: Record<string, unknown>,
  title = '',
): InterestEventKind | null {
  const kind = String(
    data.kind ?? data.type ?? data.notification_type ?? '',
  ).toLowerCase();
  const text = `${kind} ${title.toLowerCase()}`;
  if (
    !/interest|like|match/.test(text) &&
    !data.interest_id &&
    !data.interestId
  )
    return null;
  if (/accept|match/.test(text)) return 'interest_accepted';
  if (/declin|reject/.test(text)) return 'interest_declined';
  if (/withdraw|cancel/.test(text)) return 'interest_withdrawn';
  return 'interest_received';
}

export interface InterestAlert {
  id?: string;
  kind: InterestEventKind;
  senderName?: string;
  profileId?: string;
  avatarUrl?: string;
  data?: Record<string, unknown>;
}

/** Shared by push and REST fallback; display first, then remember successful delivery. */
export async function notifyInterest(
  alert: InterestAlert,
  foreground: boolean,
): Promise<void> {
  // A repeated push must still refresh the list, even if its alert is deduplicated.
  if (foreground) DeviceEventEmitter.emit('REFRESH_INTERESTS');
  const key = alert.id ? `${alert.kind}:${alert.id}` : undefined;
  if (key && (isInterestNotified(key) || inFlight.has(key))) return;
  if (key) inFlight.add(key);
  const name = alert.senderName || 'Someone';
  const accepted = alert.kind === 'interest_accepted';
  const title = accepted
    ? "It's a match"
    : alert.kind === 'interest_received'
    ? 'New interest'
    : 'Interest update';
  const message = accepted
    ? `${name} accepted your interest.`
    : alert.kind === 'interest_declined'
    ? `${name} declined your interest.`
    : alert.kind === 'interest_withdrawn'
    ? `${name} withdrew their interest.`
    : `${name} would like to connect with you.`;
  const data = {
    ...alert.data,
    kind: alert.kind,
    interest_id: alert.id,
    profile_id: alert.profileId,
  };
  let delivered = false;
  try {
    delivered = await displayNotification(
      title,
      message,
      data,
      key ? `interest-${key}` : undefined,
      CHANNEL_ID_INTERESTS,
    );
    if (delivered && key) recordInterestNotified(key);
  } finally {
    if (key) inFlight.delete(key);
  }
}
