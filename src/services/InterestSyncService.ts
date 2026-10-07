import { getReceivedInterests,getSentInterests } from '../api/interestService';
import { Interest } from '../types/models';

/** Received alerts must not wait for, or fail with, the unrelated sent list. */
export async function fetchInterestSnapshot(
  onReceived: (items: Interest[]) => void,
) {
  const [sent, received] = await Promise.allSettled([
    getSentInterests(),
    getReceivedInterests().then(items => {
      onReceived(items);
      return items;
    }),
  ]);
  if (sent.status === 'rejected' && received.status === 'rejected')
    throw received.reason;
  return {
    sent: sent.status === 'fulfilled' ? sent.value : undefined,
    received: received.status === 'fulfilled' ? received.value : undefined,
  };
}
