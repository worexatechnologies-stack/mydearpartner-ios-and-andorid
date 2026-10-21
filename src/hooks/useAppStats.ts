/**
 * useAppStats — Centralized notification and activity statistics hook.
 * Aggregates badge counts, pending interests, unread chats, and daily quotas
 * into a single reactive source so every tab stays in sync.
 */
import { useMemo } from 'react';
import { useAppData } from '../context/AppDataContext';
import { usePlanAllowance } from '../utils/planAllowance';

export interface AppStats {
  /** Total unread chat messages */
  unreadChats: number;
  /** Pending (unactioned) received interests */
  pendingInterests: number;
  /** Sum badge for the Interests tab icon */
  interestsBadge: number;
  /** Sum badge shown on notification bell */
  totalNotifications: number;
  /** Whether user is nearing their daily interest quota */
  nearingInterestLimit: boolean;
  /** Accepted connections that haven't started a chat yet */
  newMatchesCount: number;
}

export function useAppStats(): AppStats {
  const { receivedInterests, sentInterests, totalUnreadCount, chats } = useAppData();
  const { planConfig } = usePlanAllowance();

  return useMemo(() => {
    const pendingInterests = receivedInterests.filter(i => i.status === 'pending').length;
    const unreadChats = totalUnreadCount;
    const interestsBadge = pendingInterests;
    const totalNotifications = unreadChats + pendingInterests;

    // Count accepted interests not yet in a chat
    const chatPartnerIds = new Set(chats.map(c => c.otherProfile?.id).filter(Boolean));
    const newMatchesCount = [...sentInterests, ...receivedInterests].filter(i => {
      if (i.status !== 'accepted') return false;
      const otherId = i.receiverProfile?.id ?? i.senderProfile?.id;
      return otherId && !chatPartnerIds.has(otherId);
    }).length;

    // Warn if user has sent 80%+ of daily quota
    const dailyLimit = planConfig?.dailyInterests ?? 0;
    const sentToday = sentInterests.filter(i => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return i.createdAt > oneDayAgo;
    }).length;
    const nearingInterestLimit = dailyLimit > 0 && sentToday >= Math.floor(dailyLimit * 0.8);

    return {
      unreadChats,
      pendingInterests,
      interestsBadge,
      totalNotifications,
      nearingInterestLimit,
      newMatchesCount,
    };
  }, [receivedInterests, sentInterests, totalUnreadCount, chats, planConfig]);
}
