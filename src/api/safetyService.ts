import { del, post } from './apiClient';

export const reportReasons = [
  'Underage user',
  'Child exploitation or abuse',
  'Non-consensual intimate content',
  'Deepfake or impersonation',
  'Harassment or threats',
  'Scam or fraud',
  'Sexual or other prohibited content',
  'Other safety concern',
] as const;

export type ReportTarget = {
  profileId: string;
  chatId?: string;
  messageId?: string;
};

type Receipt = { id: string; status: 'received' };

export async function submitReport(target: ReportTarget, reason: string, details: string): Promise<Receipt> {
  const saved = await post<{ id: string; status: string }>('/profile-reports/', {
    reported_member: target.profileId,
    reason,
    details: [details.trim(), target.chatId ? `Conversation: ${target.chatId}` : '',
      target.messageId ? `Message: ${target.messageId}` : ''].filter(Boolean).join('\n'),
  });
  if (!saved?.id || saved.status !== 'OPEN') {
    throw new Error('The service did not confirm your request. Please try again.');
  }
  return { id: saved.id, status: 'received' };
}

export type DeletionReceipt = {
  account_status: 'DELETION_PENDING';
  recovery_until: string;
};
export async function requestAccountDeletion(): Promise<DeletionReceipt> {
  const saved = await del<DeletionReceipt>('/member-auth/account/delete/');
  if (saved?.account_status !== 'DELETION_PENDING' || !saved.recovery_until ||
      !Number.isFinite(Date.parse(saved.recovery_until))) {
    throw new Error('The service did not confirm your request. Please try again.');
  }
  return saved;
}
