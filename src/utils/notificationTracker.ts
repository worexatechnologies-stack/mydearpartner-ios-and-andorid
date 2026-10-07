/**
 * MyDearPartner — Notification Tracker
 *
 * Provides shared state across FCM push listeners, WebSocket handlers,
 * and React Context to:
 *   1. Track currently opened/active chat (suppresses in-app notifications for that chat)
 *   2. Deduplicate notifications between FCM, WebSockets, and REST polling
 */

let _activeChatId: string | null = null;
let _myProfileId: string | null = null;
let _myMemberId: string | null = null;
const _notifiedMessageIds = new Set<string>();
const _notifiedInterestIds = new Set<string>();
const MAX_TRACKED_ENTRIES = 500;

export function setActiveChatId(chatId: string | null): void {
  _activeChatId = chatId;
}

export function getActiveChatId(): string | null {
  return _activeChatId;
}

export function setMyUserIds(
  profileId: string | null | undefined,
  memberId: string | null | undefined,
): void {
  if (profileId) _myProfileId = String(profileId);
  if (memberId) _myMemberId = String(memberId);
}

export function resetNotificationTracker(): void {
  _activeChatId = null;
  _myProfileId = null;
  _myMemberId = null;
  _notifiedMessageIds.clear();
  _notifiedInterestIds.clear();
}

export function getMyUserIds(): {
  profileId: string | null;
  memberId: string | null;
} {
  return { profileId: _myProfileId, memberId: _myMemberId };
}

export function isSelfUserId(id: string | null | undefined): boolean {
  if (!id) return false;
  const s = String(id).trim();
  if (!s || s === 'undefined' || s === 'null') return false;
  return s === _myProfileId || s === _myMemberId;
}

export function isMessageNotified(key: string): boolean {
  return _notifiedMessageIds.has(key);
}

export function recordMessageNotified(key: string): void {
  if (_notifiedMessageIds.size >= MAX_TRACKED_ENTRIES) {
    const first = _notifiedMessageIds.values().next().value;
    if (first) _notifiedMessageIds.delete(first);
  }
  _notifiedMessageIds.add(key);
}

export function isInterestNotified(key: string): boolean {
  return _notifiedInterestIds.has(key);
}

export function recordInterestNotified(key: string): void {
  if (_notifiedInterestIds.size >= MAX_TRACKED_ENTRIES) {
    const first = _notifiedInterestIds.values().next().value;
    if (first) _notifiedInterestIds.delete(first);
  }
  _notifiedInterestIds.add(key);
}
