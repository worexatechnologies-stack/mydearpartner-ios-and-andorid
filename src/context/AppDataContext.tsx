import { failureDelivery, restoreMessageDelivery } from '../utils/messageDelivery';
import { useLatestCallback } from '../hooks/useLatestCallback';
import { fetchInterestSnapshot } from '../services/InterestSyncService';
import { waitForMessagingCryptoReady } from '../services/MessagingCryptoLifecycle';
import { isInterestQuotaError } from '../utils/interestErrors';
// @refresh reset
/**
 * MyDearPartner — App Data Context
 *
 * Now connected to the Django REST Framework backend at https://mydearpartner.in/api/v1/
 *
 * What changed from the local-only version:
 *  - discoverProfiles fetched from /api/v1/profiles/ (real backend data)
 *  - interests fetched from /api/v1/interests/sent/ and /api/v1/interests/received/
 *  - chats fetched from /api/v1/conversations/
 *  - messages fetched from /api/v1/conversations/{id}/messages/
 *  - sendInterest, respondToInterest, sendMessage all call backend
 *  - WebSocket used for real-time chat (falls back to REST if WS unavailable)
 *  - shortlist kept in AsyncStorage (feature flag: add /api/v1/shortlist/ when backend ready)
 *
 * What is preserved:
 *  - The AppDataContextValue interface (no screen changes needed)
 *  - All existing screen prop signatures
 */

import React,{
createContext,
useCallback,
useContext,
useEffect,
useMemo,
useRef,
useState,
} from 'react';
import { Alert,AppState,DeviceEventEmitter } from 'react-native';
import {
Chat,
FilterOptions,
Interest,
Message,
Profile,
} from '../types/models';
import {
StorageKeys,
accountStorageKey,
getItem,
setItem,
} from '../utils/storage';
import {
CachedInterests,
persistChats,
persistDiscoverProfiles,
persistInterests,
persistMessages,
persistProfileCache,
} from '../services/BackgroundDataStore';

import { blockService } from '../api/blockService';
import * as ChatService from '../api/chatService';
import * as InterestService from '../api/interestService';
import * as ProfileService from '../api/profileService';
import { SearchFilters } from '../api/types';
import { chatWsClient } from '../api/wsClient';
import {
E2EE_DECRYPT_FAILED,
encryptMessageForChat,
smartDecryptText,
} from '../utils/crypto';
import { getMemberUserIdFromToken } from '../utils/jwt';
import { loadTokens,saveUserIds } from '../utils/keychain';
import {
setActiveChatId,
setMyUserIds,
} from '../utils/notificationTracker';
import {
markDailyInterestsExhausted,
recordInterestSentToday,
} from '../utils/planAllowance';
import analyticsService, { getTimeToEventBand } from '../services/analyticsService';
import { useAuth } from './AuthContext';
// System push notifications are now handled exclusively by the FCM background
// handler in index.js. Only in-app showInAppNotification is used here.

export interface InterestRelationship {
  sent?: Interest;
  received?: Interest;
  status: 'none' | 'sent' | 'received' | 'accepted' | 'declined';
  isMutual: boolean;
  activeInterest?: Interest;
}

interface AppDataContextValue {
  allProfiles: Profile[];
  discoverProfiles: Profile[];
  isLoadingProfiles: boolean;
  profilesError: string | null;
  interestsError: string | null;
  chatsError: string | null;
  getProfileById: (id: string) => Profile | undefined;
  sentInterests: Interest[];
  receivedInterests: Interest[];
  sendInterest: (toProfileId: string, toUserId?: string) => Promise<void>;
  cancelInterest: (interestId: string) => Promise<void>;
  respondToInterest: (
    interestId: string,
    status: 'accepted' | 'declined',
  ) => Promise<void>;
  interestStatusFor: (profileId: string) => Interest | undefined;
  getSentInterestTo: (profileId: string) => Interest | undefined;
  getReceivedInterestFrom: (profileId: string) => Interest | undefined;
  getInterestRelationship: (profileId: string) => InterestRelationship;
  chats: Chat[];
  getMessagesForChat: (chatId: string) => Message[];
  loadChatMessages: (chatId: string, partnerId?: string) => Promise<void>;
  loadOlderChatMessages: (chatId: string, partnerId?: string) => Promise<void>;
  getChatHistoryState: (chatId: string) => { next: string | null; loading: boolean; error?: string };
  connectToChat: (
    chatId: string,
    partnerId?: string,
    onTyping?: (isTyping: boolean) => void,
    onPresence?: (isOnline: boolean) => void,
  ) => void;
  disconnectFromChat: () => void;
  getOrCreateChatWith: (otherProfileId: string) => Promise<Chat>;
  sendMessage: (
    chatId: string,
    text: string,
    partnerId?: string,
    retryId?: string,
  ) => Promise<void>;
  dismissLocalMessage: (chatId: string, messageId: string) => void;
  getOtherParticipantId: (chat: Chat) => string;
  shortlistedIds: string[];
  shortlistedProfiles: Profile[];
  toggleShortlist: (profileId: string) => Promise<void>;
  isShortlisted: (profileId: string) => boolean;
  filterProfiles: (options: FilterOptions) => Profile[];
  refreshDiscoverProfiles: (filters?: FilterOptions) => Promise<void>;
  refreshInterests: () => Promise<void>;
  refreshChats: () => Promise<void>;
  refreshAll: () => Promise<void>;
  totalUnreadCount: number;
  markChatAsRead: (chatId: string, partnerId?: string) => void;
  isIncognitoMode: boolean;
  setIncognitoMode: (value: boolean) => void;
  clearedNotificationIds: string[];
  clearNotifications: (ids: string[]) => void;
  /** The member/account id used for E2EE key derivation. Exposed so screens can
   *  re-trigger decryption once the member id has been loaded from the keychain. */
  cryptoMyId: string;
  /** IDs of profiles that the current user has blocked */
  blockedIds: Set<string>;
  /** Block a profile — updates state globally and calls API */
  blockUser: (profileId: string) => Promise<void>;
  /** Unblock a profile — updates state globally and calls API */
  unblockUser: (profileId: string) => Promise<void>;
  /** Returns true if the current user has blocked this profile */
  isBlockedByMe: (profileId: string) => boolean;
  /** IDs of users/chats that are muted */
  mutedUserIds: Set<string>;
  /** Toggle mute/unmute for a user or chat */
  toggleMuteUser: (userId: string, alternateId?: string) => Promise<boolean>;
  /** Returns true if this user or chat is muted */
  isUserMuted: (userId: string) => boolean;
}

const AppDataContext = createContext<AppDataContextValue | undefined>(
  undefined,
);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const myId = currentUser?.id ?? '';
  const myProfileId = currentUser?.profile?.id || myId;

  // The E2EE key seed must match the WEB client, which uses the MEMBER/account
  // user id (from the JWT), NOT the profile id. Profile id and member id differ.
  const [myMemberId, setMyMemberId] = useState<string>('');
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    (async () => {
      try {
        const stored = await loadTokens();
        if (cancelled) return;
        const mid = stored?.accessToken
          ? getMemberUserIdFromToken(stored.accessToken)
          : null;
        setMyMemberId(mid ?? '');
        const profileId = myProfileId;
        setMyUserIds(profileId, mid);
        if (mid && profileId) await saveUserIds(profileId, mid);
      } catch {
        if (!cancelled) setMyMemberId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myProfileId, myId]);
  // The id to use for E2EE key derivation (matches web's [me, partner] seed).
  const cryptoMyId = myMemberId || myId;

  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [discoverProfiles, setDiscoverProfiles] = useState<Profile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, Profile>>({});
  const [interests, setInterests] = useState<Interest[]>([]);
  const [sentInterestsList, setSentInterestsList] = useState<Interest[]>([]);
  const [receivedInterestsList, setReceivedInterestsList] = useState<
    Interest[]
  >([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  type HistoryState = { next: string | null; loading: boolean; error?: string; loadedOlder?: boolean };
  const [historyPages, setHistoryPages] = useState<Record<string, HistoryState>>({});
  const historyPagesRef = useRef<Record<string, HistoryState>>({});
  const historyCursorsRef = useRef<Record<string, Set<string>>>({});
  const updateHistory = useCallback((chatId: string, patch: Partial<HistoryState>) => {
    const next = { ...historyPagesRef.current, [chatId]: {
      ...(historyPagesRef.current[chatId] ?? { next: null, loading: false }), ...patch,
    } };
    historyPagesRef.current = next;
    setHistoryPages(next);
  }, []);
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [shortlistedProfilesList, setShortlistedProfilesList] = useState<
    Profile[]
  >([]);
  const [isIncognitoMode, setIncognitoMode] = useState<boolean>(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [mutedUserIds, setMutedUserIds] = useState<Set<string>>(new Set());

  const [clearedNotificationIds, setClearedNotificationIds] = useState<
    string[]
  >([]);

  // Load member preferences & cached app data separately for every signed-in account.
  useEffect(() => {
    let active = true;
    if (!myId) {
      setMutedUserIds(new Set());
      setClearedNotificationIds([]);
      return () => {
        active = false;
      };
    }
    // Instant Hydration from local storage
    getItem<string[]>(accountStorageKey(StorageKeys.MUTED_USERS, myId)).then(
      ids => {
        if (active) setMutedUserIds(new Set(ids ?? []));
      },
    );
    getItem<string[]>(accountStorageKey(StorageKeys.CLEARED_NOTIFS, myId)).then(
      ids => {
        if (active) setClearedNotificationIds(ids ?? []);
      },
    );
    getItem<Profile[]>(accountStorageKey(StorageKeys.DISCOVER_PROFILES, myId)).then(
      cached => {
        if (active && cached && cached.length > 0) {
          setDiscoverProfiles(prev => (prev.length === 0 ? cached : prev));
        }
      },
    );
    getItem<Chat[]>(accountStorageKey(StorageKeys.CHATS, myId)).then(
      cached => {
        if (active && cached && cached.length > 0) {
          setChats(prev => (prev.length === 0 ? cached : prev));
          if (!chatsRef.current?.length) chatsRef.current = cached;
        }
      },
    );
    getItem<CachedInterests>(accountStorageKey(StorageKeys.INTERESTS, myId)).then(
      cached => {
        if (active && cached) {
          if (cached.sent?.length) {
            setSentInterestsList(prev => (prev.length === 0 ? cached.sent : prev));
          }
          if (cached.received?.length) {
            setReceivedInterestsList(prev => (prev.length === 0 ? cached.received : prev));
          }
          if (cached.merged?.length) {
            setInterests(prev => (prev.length === 0 ? cached.merged : prev));
          }
        }
      },
    );
    getItem<Record<string, Message[]>>(accountStorageKey(StorageKeys.MESSAGES, myId)).then(
      cached => {
        if (active && cached) {
          setMessages(prev => (Object.keys(prev).length === 0 ? restoreMessageDelivery(cached) : { ...restoreMessageDelivery(cached), ...prev }));
        }
      },
    );
    getItem<Record<string, Profile>>(accountStorageKey(StorageKeys.PROFILE_CACHE, myId)).then(
      cached => {
        if (active && cached) {
          setProfileCache(prev => ({ ...cached, ...prev }));
        }
      },
    );
    return () => {
      active = false;
    };
  }, [myId]);

  const clearNotifications = useCallback(
    (ids: string[]) => {
      setClearedNotificationIds(prev => {
        const merged = [...prev, ...ids];
        if (myId) {
          setItem(accountStorageKey(StorageKeys.CLEARED_NOTIFS, myId), merged);
        }
        return merged;
      });
    },
    [myId],
  );

  const pollTimerRef = useRef<any>(null);
  // Ref that always holds the latest chats (for use inside polling callbacks)
  const chatsRef = useRef<Chat[]>([]);
  const discoverProfilesRef = useRef<Profile[]>([]);
  const sentInterestsListRef = useRef<Interest[]>([]);
  const receivedInterestsListRef = useRef<Interest[]>([]);
  const interestsRef = useRef<Interest[]>([]);
  const messagesRef = useRef<Record<string, Message[]>>({});
  const profileCacheRef = useRef<Record<string, Profile>>({});
  const cryptoMyIdRef = useRef<string | undefined>(cryptoMyId);
  const myIdRef = useRef<string>(myId);
  const myMemberIdRef = useRef<string>(myMemberId);
  const loadingChatsRef = useRef<Set<string>>(new Set());

  // Ref tracking which chat the user currently has open — used to suppress notifications
  const activeChatIdRef = useRef<string | null>(null);
  const loadInterestsInFlightRef = useRef(false);
  const pendingInterestActions = useRef(new Set<string>());
  const interestRevision = useRef(0);
  const discoverRevision = useRef(0);
  const loadChatsInFlightRef = useRef(false);

  useEffect(() => {
    chatsRef.current = chats;
  }, [chats]);

  useEffect(() => {
    discoverProfilesRef.current = discoverProfiles;
  }, [discoverProfiles]);

  useEffect(() => {
    sentInterestsListRef.current = sentInterestsList;
  }, [sentInterestsList]);

  useEffect(() => {
    receivedInterestsListRef.current = receivedInterestsList;
  }, [receivedInterestsList]);

  useEffect(() => {
    interestsRef.current = interests;
  }, [interests]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    profileCacheRef.current = profileCache;
  }, [profileCache]);

  useEffect(() => {
    cryptoMyIdRef.current = cryptoMyId;
  }, [cryptoMyId]);

  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);

  useEffect(() => {
    myMemberIdRef.current = myMemberId;
  }, [myMemberId]);

  // ─── Initial Data Load ───────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;

    // Load from backend
    loadDiscoverProfiles();
    loadInterests();
    loadShortlists();
    loadChats();
    loadBlockedUsers();
  }, [currentUser?.id, currentUser?.profile?.gender]); // eslint-disable-line react-hooks/exhaustive-deps

  const { refreshCurrentUser } = useAuth();

  // ─── Discover Profiles ───────────────────────────────────────────────────
  const loadDiscoverProfiles = useLatestCallback(
    async (filters?: SearchFilters) => {
      if (!currentUser) return;
      const revision = ++discoverRevision.current;
      setIsLoadingProfiles(true);
      setProfilesError(null);
      try {
        const myGender = (currentUser.profile?.gender ?? '').toLowerCase();
        // Determine target gender: female accounts look for Male, male accounts look for Female
        const requestedGender = filters?.gender;
        let targetGender: string | undefined = requestedGender;

        if (!requestedGender) {
          if (myGender === 'female') targetGender = 'Male';
          else if (myGender === 'male') targetGender = 'Female';
        }

        const activeFilters: SearchFilters = {
          page_size: 100,
          ...filters,
          gender:
            targetGender && targetGender !== 'all' ? targetGender : undefined,
        };

        const { profiles } = await ProfileService.getDiscoverProfiles(
          activeFilters,
        );

        if (revision !== discoverRevision.current) return;
        // Collect IDs of connected/contacted profiles
        const connectedIds = new Set<string>();
        const fullyConnectedIds = new Set<string>(); // Users to completely remove

        // 1. Active/existing chats
        (chatsRef.current || chats).forEach(chat => {
          if (chat.otherProfile?.id) {
            connectedIds.add(String(chat.otherProfile.id));
            fullyConnectedIds.add(String(chat.otherProfile.id));
          }
          if (chat.otherProfile?.userId) {
            connectedIds.add(String(chat.otherProfile.userId));
            fullyConnectedIds.add(String(chat.otherProfile.userId));
          }
          if (chat.participantIds) {
            chat.participantIds.forEach(pId => {
              if (pId !== myId && pId !== myMemberId) {
                connectedIds.add(String(pId));
                fullyConnectedIds.add(String(pId));
              }
            });
          }
        });

        // 2. All interests (sent, received, accepted, declined)
        interests.forEach(i => {
          const toAdd = [
            i.toUserId,
            i.fromUserId,
            i.receiverProfile?.id,
            i.receiverProfile?.userId,
            i.senderProfile?.id,
            i.senderProfile?.userId,
          ];
          toAdd.forEach(id => {
            if (
              id &&
              String(id) !== String(myId) &&
              String(id) !== String(myMemberId)
            ) {
              connectedIds.add(String(id));
            }
          });
        });

        // 3. Blocked users
        const strictlyBlockedIds = new Set<string>();
        blockedIds.forEach(bId => {
          connectedIds.add(String(bId));
          fullyConnectedIds.add(String(bId));
          strictlyBlockedIds.add(String(bId));
        });

        // Exclude only own profile & blocked profiles so search has all profiles
        const seenProfileIds = new Set<string>();
        const allValid = profiles.filter(p => {
          const pid = String(p.id);
          if (seenProfileIds.has(pid)) return false;
          seenProfileIds.add(pid);

          if (p.id === myId || p.userId === myId) return false;
          if (myMemberId && (p.id === myMemberId || p.userId === myMemberId))
            return false;
          if (
            strictlyBlockedIds.has(String(p.id)) ||
            strictlyBlockedIds.has(String(p.userId))
          )
            return false;

          if (targetGender && targetGender !== 'all') {
            const pGender = (p.gender ?? '').toLowerCase();
            const targetLower = targetGender.toLowerCase();
            if (pGender && pGender !== targetLower) return false;
          }
          return true;
        });

        setAllProfiles(allValid);

        const myProfile = currentUser.profile;

        // Location-based prioritization:
        // Priority 0: Same City (shows first)
        // Priority 1: Same State (shows next)
        // Priority 2: All other locations (shows after same location profiles are exhausted)
        const getPriorityScore = (p: Profile): number => {
          if (!myProfile) return 2;

          const pCity = (p.city ?? '').toLowerCase().trim();
          const myCity = (myProfile.city ?? '').toLowerCase().trim();
          if (
            myCity &&
            (pCity === myCity ||
              pCity.includes(myCity) ||
              myCity.includes(pCity))
          ) {
            return 0; // Same city first
          }

          const pState = (p.state ?? '').toLowerCase().trim();
          const myState = (myProfile.state ?? '').toLowerCase().trim();
          if (
            myState &&
            (pState === myState ||
              pState.includes(myState) ||
              myState.includes(pState))
          ) {
            return 1; // Same state second
          }

          return 2; // Others after same location profiles are completed
        };

        // In discover feed, strictly exclude anyone we've already interacted with
        const discoverableOnly = allValid.filter(p => {
          if (
            connectedIds.has(String(p.id)) ||
            connectedIds.has(String(p.userId))
          ) {
            return false;
          }
          return true;
        });

        const sorted = discoverableOnly.sort((a, b) => {
          const scoreA = getPriorityScore(a);
          const scoreB = getPriorityScore(b);
          if (scoreA !== scoreB) {
            return scoreA - scoreB;
          }
          return 0;
        });

        setDiscoverProfiles(sorted);
        // Cache profiles by ID for quick lookup
        const cache: Record<string, Profile> = {};
        sorted.forEach(p => {
          cache[p.id] = p;
        });
        setProfileCache(prev => ({ ...prev, ...cache }));
        if (myIdRef.current && sorted.length > 0) {
          persistDiscoverProfiles(sorted, myIdRef.current);
          persistProfileCache(cache, myIdRef.current);
        }
      } catch {
        if (revision === discoverRevision.current) setProfilesError('Could not load profiles. Check your connection and try again.');
        // We no longer fallback to mock data to ensure strict API synchronization.
      } finally {
        if (revision === discoverRevision.current) setIsLoadingProfiles(false);
      }
    },
  );

  const refreshDiscoverProfiles = useCallback(
    async (filters?: FilterOptions) => {
      const apiFilters: SearchFilters = {};
      if (filters?.gender && filters.gender !== 'all')
        apiFilters.gender = filters.gender;
      if (filters?.minAge) apiFilters.min_age = filters.minAge;
      if (filters?.maxAge) apiFilters.max_age = filters.maxAge;
      if (filters?.city) apiFilters.city = filters.city;
      if (filters?.religion) apiFilters.religion = filters.religion;
      if (filters?.profession) apiFilters.profession = filters.profession;
      if (filters?.verifiedOnly) apiFilters.verified_only = true;
      await loadDiscoverProfiles(apiFilters);
    },
    [currentUser?.id, currentUser?.profile?.gender], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ─── Profile Lookup ──────────────────────────────────────────────────────
  const getProfileById = useCallback(
    (id: string): Profile | undefined => {
      if (currentUser && id === currentUser.id) return currentUser.profile;
      if (profileCache[id]) return profileCache[id];
      return undefined;
    },
    [currentUser, profileCache],
  );

  // ─── Interests ───────────────────────────────────────────────────────────
  const loadInterests = useLatestCallback(async () => {
    if (!currentUser || loadInterestsInFlightRef.current || pendingInterestActions.current.size > 0) return;
    loadInterestsInFlightRef.current = true;
    setInterestsError(null);
    const revision = interestRevision.current;
    try {
      const snapshot = await fetchInterestSnapshot(received => {
        if (revision === interestRevision.current) setReceivedInterestsList(received);
      });
      if (revision !== interestRevision.current) return;
      const sent = snapshot.sent ?? sentInterestsList;
      const received = snapshot.received ?? receivedInterestsList;

      // Cache all embedded profiles so cards in Activity always render
      const newCache: Record<string, Profile> = {};
      sent.forEach(i => {
        if (i.receiverProfile)
          newCache[i.receiverProfile.id] = i.receiverProfile;
        if (i.senderProfile) newCache[i.senderProfile.id] = i.senderProfile;
      });
      received.forEach(i => {
        if (i.senderProfile) newCache[i.senderProfile.id] = i.senderProfile;
        if (i.receiverProfile)
          newCache[i.receiverProfile.id] = i.receiverProfile;
      });
      if (Object.keys(newCache).length > 0) {
        setProfileCache(prev => ({ ...prev, ...newCache }));
      }

      setSentInterestsList(sent);
      setReceivedInterestsList(received);

      const merged = [...sent];
      received.forEach(r => {
        if (!merged.some(m => m.id === r.id)) {
          merged.push(r);
        }
      });
      setInterests(merged);
      if (myIdRef.current) {
        persistInterests({ sent, received, merged }, myIdRef.current);
      }
    } catch {
      setInterestsError('Could not refresh activity. Please try again.');
    } finally {
      loadInterestsInFlightRef.current = false;
    }
  });

  const sentInterests = useMemo(
    () =>
      sentInterestsList.length > 0
        ? sentInterestsList
        : interests.filter(i => i.fromUserId === (myMemberId || myId)),
    [sentInterestsList, interests, myId, myMemberId],
  );

  const receivedInterests = useMemo(
    () =>
      receivedInterestsList.length > 0
        ? receivedInterestsList
        : interests.filter(i => i.toUserId === (myMemberId || myId)),
    [receivedInterestsList, interests, myId, myMemberId],
  );

  const getOrCreateChatWith = useCallback(
    async (otherProfileId: string): Promise<Chat> => {
      const profile = getProfileById(otherProfileId);
      const otherUserId = profile?.userId || undefined;

      const chatList = chatsRef.current?.length ? chatsRef.current : chats;
      const existing = chatList.find(
        c =>
          c.otherProfile?.id === otherProfileId ||
          c.otherProfile?.userId === otherProfileId ||
          c.participantIds?.includes(otherProfileId) ||
          (otherUserId && (
            c.otherProfile?.id === otherUserId ||
            c.otherProfile?.userId === otherUserId ||
            c.participantIds?.includes(otherUserId)
          )),
      );
      if (existing) return existing;

      try {
        const newChat = await ChatService.getOrCreateChat(
          otherProfileId,
          cryptoMyId,
          otherUserId,
        );
        setChats(prev => {
          const alreadyExists = prev.some(c => c.id === newChat.id);
          return alreadyExists ? prev : [...prev, newChat];
        });
        return newChat;
      } catch (err: any) {
        console.warn('[AppData] getOrCreateChatWith error:', err?.message);
        throw err;
      }
    },
    [chats, cryptoMyId, getProfileById],
  );

  const getSentInterestTo = useCallback(
    (profileId: string): Interest | undefined => {
      const partnerProfile = getProfileById(profileId);
      const partnerUserId = partnerProfile?.userId;
      const lookupMe = String(myMemberId || myId || '');

      const isTarget = (i: Interest) => {
        if (i.status === 'cancelled' || i.status === 'withdrawn') return false;
        return (
          String(i.toUserId) === String(profileId) ||
          (partnerUserId && String(i.toUserId) === String(partnerUserId)) ||
          (i.receiverProfile?.id &&
            String(i.receiverProfile.id) === String(profileId))
        );
      };

      const fromSent = sentInterestsList.find(isTarget);
      if (fromSent) return fromSent;

      return interests.find(i => {
        const isFromMe =
          lookupMe &&
          (String(i.fromUserId) === lookupMe ||
            String(i.fromUserId) === String(myId));
        return isFromMe && isTarget(i);
      });
    },
    [sentInterestsList, interests, myId, myMemberId, getProfileById],
  );

  const getReceivedInterestFrom = useCallback(
    (profileId: string): Interest | undefined => {
      const partnerProfile = getProfileById(profileId);
      const partnerUserId = partnerProfile?.userId;
      const lookupMe = String(myMemberId || myId || '');

      const isSource = (i: Interest) => {
        if (i.status === 'cancelled' || i.status === 'withdrawn') return false;
        return (
          String(i.fromUserId) === String(profileId) ||
          (partnerUserId && String(i.fromUserId) === String(partnerUserId)) ||
          (i.senderProfile?.id &&
            String(i.senderProfile.id) === String(profileId))
        );
      };

      const fromReceived = receivedInterestsList.find(isSource);
      if (fromReceived) return fromReceived;

      return interests.find(i => {
        const isToMe =
          lookupMe &&
          (String(i.toUserId) === lookupMe ||
            String(i.toUserId) === String(myId));
        return isToMe && isSource(i);
      });
    },
    [receivedInterestsList, interests, myId, myMemberId, getProfileById],
  );

  const getInterestRelationship = useCallback(
    (profileId: string): InterestRelationship => {
      const sent = getSentInterestTo(profileId);
      const received = getReceivedInterestFrom(profileId);

      const isAcceptedMatch =
        sent?.status === 'accepted' || received?.status === 'accepted';

      const isMutual =
        isAcceptedMatch ||
        Boolean(
          sent &&
            received &&
            sent.status !== 'declined' &&
            received.status !== 'declined',
        );

      let status: InterestRelationship['status'] = 'none';
      if (isAcceptedMatch || isMutual) {
        status = 'accepted';
      } else if (sent && sent.status === 'pending') {
        status = 'sent';
      } else if (received && received.status === 'pending') {
        status = 'received';
      } else if (
        sent?.status === 'declined' ||
        received?.status === 'declined'
      ) {
        status = 'declined';
      }

      return {
        sent,
        received,
        status,
        isMutual,
        activeInterest: isMutual
          ? sent?.status === 'accepted'
            ? sent
            : received || sent
          : sent || received,
      };
    },
    [getSentInterestTo, getReceivedInterestFrom],
  );

  const interestStatusFor = useCallback(
    (profileId: string): Interest | undefined => {
      const rel = getInterestRelationship(profileId);
      if (rel.isMutual) {
        return rel.sent || rel.received;
      }
      if (rel.sent && rel.sent.status !== 'declined') {
        return rel.sent;
      }
      return undefined;
    },
    [getInterestRelationship],
  );

  const respondToInterest = useCallback(
    async (interestId: string, status: 'accepted' | 'declined') => {
      if (pendingInterestActions.current.has(interestId)) return;
      pendingInterestActions.current.add(interestId);
      interestRevision.current += 1;
      try {
        const updated = await InterestService.respondToInterest(
          interestId,
          status,
        );
        setInterests(prev =>
          prev.map(i => (i.id === interestId ? updated : i)),
        );
        setReceivedInterestsList(prev =>
          prev.map(i => (i.id === interestId ? updated : i)),
        );
        setSentInterestsList(prev =>
          prev.map(i => (i.id === interestId ? updated : i)),
        );
        // If accepted, create a chat with the other profile
        if (status === 'accepted') {
          const target =
            interests.find(i => i.id === interestId) ||
            receivedInterestsList.find(i => i.id === interestId) ||
            updated;
          if (target) {
            const isMeSender =
              target.fromUserId === myId || target.fromUserId === myMemberId;
            const otherProfileId = isMeSender
              ? target.receiverProfile?.id || target.toUserId
              : target.senderProfile?.id || target.fromUserId;
            if (otherProfileId) {
              const reopened = chatsRef.current.map(chat =>
                chat.otherProfile?.id === otherProfileId || chat.otherProfile?.userId === otherProfileId || chat.participantIds.includes(otherProfileId)
                  ? { ...chat, connectionClosed: false } : chat);
              chatsRef.current = reopened;
              setChats(reopened);
              setDiscoverProfiles(prev =>
                prev.filter(
                  p =>
                    String(p.id) !== String(otherProfileId) &&
                    String(p.userId) !== String(otherProfileId),
                ),
              );
              // Acceptance is already committed; chat creation failure must
              // not invite the user to submit the accepted request again.
              await getOrCreateChatWith(String(otherProfileId)).catch(() => {
                DeviceEventEmitter.emit('REFRESH_CHATS');
              });
              const createdTimestamp =
                typeof target.createdAt === 'number'
                  ? target.createdAt
                  : target.createdAt
                  ? new Date(target.createdAt).getTime()
                  : undefined;
              analyticsService
                .trackMutualInterest({
                  time_to_event_band: getTimeToEventBand(createdTimestamp),
                })
                .catch(() => {});
            }
          }
        }
      } catch (err: any) {
        console.warn('[AppData] respondToInterest error:', err?.message);
        throw err;
      } finally {
        pendingInterestActions.current.delete(interestId);
      }
    },
    [interests, receivedInterestsList, myId, myMemberId, getOrCreateChatWith],
  );

  const sendInterest = useCallback(
    async (toProfileId: string, toUserId?: string) => {
      
      const rel = getInterestRelationship(toProfileId);

      // If the partner already sent us an interest, reciprocating creates a mutual match!
      if (rel.received && rel.received.status === 'pending') {
        
        await respondToInterest(rel.received.id, 'accepted');
        return;
      }

      // If already mutually matched, no duplicate action needed
      if (rel.isMutual) {
        
        return;
      }

      // If we already sent an active pending interest, abort duplicate
      if (rel.sent && rel.sent.status === 'pending') {
        
        return;
      }

      if (pendingInterestActions.current.has(toProfileId)) return;
      pendingInterestActions.current.add(toProfileId);
      interestRevision.current += 1;
      const partnerProfile = getProfileById(toProfileId);
      const resolvedUserId = toUserId || partnerProfile?.userId;
      const tempId = `temp-sent-${Date.now()}`;

      // Optimistically show interest sent immediately (0ms UI latency)
      const optimisticInterest: Interest = {
        id: tempId,
        fromUserId: myId || myMemberId || 'me',
        toUserId: resolvedUserId || toProfileId,
        receiverProfile: partnerProfile,
        status: 'pending',
        createdAt: Date.now(),
      };
      setInterests(prev => [
        ...prev.filter(i => i.id !== tempId),
        optimisticInterest,
      ]);
      setSentInterestsList(prev => [
        ...prev.filter(i => i.id !== tempId),
        optimisticInterest,
      ]);
      setDiscoverProfiles(prev =>
        prev.filter(
          p =>
            String(p.id) !== String(toProfileId) &&
            String(p.userId) !== String(toProfileId) &&
            String(p.userId) !== String(resolvedUserId),
        ),
      );

      try {
        
        const newInterest = await InterestService.sendInterest(
          toProfileId,
          resolvedUserId,
        );
        
        setInterests(prev => [
          ...prev.filter(i => i.id !== tempId && i.id !== newInterest.id),
          newInterest,
        ]);
        setSentInterestsList(prev => [
          ...prev.filter(i => i.id !== tempId && i.id !== newInterest.id),
          newInterest,
        ]);
        setDiscoverProfiles(prev =>
          prev.filter(
            p =>
              String(p.id) !== String(toProfileId) &&
              String(p.userId) !== String(toProfileId) &&
              String(p.userId) !== String(resolvedUserId),
          ),
        );
        await recordInterestSentToday(toProfileId, myId).catch(() => {});
        analyticsService
          .trackInterestSent({
            cohort: partnerProfile?.city || 'unknown',
            action_context: 'discover_feed',
          })
          .catch(() => {});
        DeviceEventEmitter.emit('REFRESH_INTERESTS');
      } catch (err: any) {
        // Rollback optimistic sent interest on failure
        setInterests(prev => prev.filter(i => i.id !== tempId));
        setSentInterestsList(prev => prev.filter(i => i.id !== tempId));
        
        if (isInterestQuotaError(err)) {
          await markDailyInterestsExhausted(true, myId).catch(() => {});
        }
        if (partnerProfile) setDiscoverProfiles(prev =>
          prev.some(profile => profile.id === partnerProfile.id) ? prev : [...prev, partnerProfile]);
        throw err;
      } finally {
        pendingInterestActions.current.delete(toProfileId);
      }
    },
    [
      getInterestRelationship,
      getProfileById,
      respondToInterest,
      myId,
      myMemberId,
    ],
  );

  const cancelInterest = useCallback(async (interestId: string) => {
    if (pendingInterestActions.current.has(interestId)) return;
    const interest = interests.find(item => item.id === interestId)
      || sentInterestsList.find(item => item.id === interestId)
      || receivedInterestsList.find(item => item.id === interestId);
    if (!interest || !['pending', 'accepted'].includes(interest.status)) {
      throw new Error('This connection is no longer active. Refresh your activity.');
    }
    pendingInterestActions.current.add(interestId);
    interestRevision.current += 1;
    try {
      const isReceiver = interest.toUserId === myId || interest.toUserId === myMemberId;
      if (isReceiver) await InterestService.respondToInterest(interestId, 'declined');
      else if (interest.status === 'accepted') await InterestService.removeConnection(interestId);
      else await InterestService.cancelInterest(interestId);
      setInterests(prev => prev.filter(item => item.id !== interestId));
      setSentInterestsList(prev => prev.filter(item => item.id !== interestId));
      setReceivedInterestsList(prev => prev.filter(item => item.id !== interestId));
      if (interest.status === 'accepted') {
        const partnerIds = [isReceiver ? interest.fromUserId : interest.toUserId,
          isReceiver ? interest.senderProfile?.id : interest.receiverProfile?.id,
          isReceiver ? interest.senderProfile?.userId : interest.receiverProfile?.userId].filter(Boolean);
        const closed = chatsRef.current.map(chat =>
          partnerIds.some(id => chat.participantIds.includes(id!) || chat.otherProfile?.id === id || chat.otherProfile?.userId === id)
            ? { ...chat, connectionClosed: true } : chat);
        chatsRef.current = closed;
        setChats(closed);
        DeviceEventEmitter.emit('REFRESH_CHATS');
        DeviceEventEmitter.emit('REFRESH_INTERESTS');
      }
    } finally {
      pendingInterestActions.current.delete(interestId);
    }
  }, [interests, sentInterestsList, receivedInterestsList, myId, myMemberId]);

  // ─── Chats ───────────────────────────────────────────────────────────────
  const loadChats = useLatestCallback(async () => {
    if (!currentUser || loadChatsInFlightRef.current) return;
    // Use ref values so this always picks up the current IDs even inside
    // polling callbacks (which close over stale values from the initial render)
    loadChatsInFlightRef.current = true;
    setChatsError(null);
    try {
      const effectiveId = await waitForMessagingCryptoReady();
      if (!effectiveId) return;
      const data = await ChatService.getChats(effectiveId);
      
      const updatedChats = data.map(chat => ({ ...chat,
        connectionClosed: chatsRef.current.find(previous => previous.id === chat.id)?.connectionClosed,
      }));
      setChats(updatedChats);
      if (myIdRef.current) {
        persistChats(updatedChats, myIdRef.current);
      }
    } catch {
      setChatsError('Could not refresh conversations. Please try again.');
    } finally {
      loadChatsInFlightRef.current = false;
    }
  });

  const getMessagesForChat = useCallback(
    (chatId: string) =>
      [...(messages[chatId] ?? [])].sort((a, b) => a.createdAt - b.createdAt),
    [messages],
  );

  const getOtherParticipantId = useCallback(
    (chat: Chat) =>
      chat.participantIds?.find(id => id !== myId) ?? chat.participantIds?.[0],
    [myId],
  );

  const sendsInFlight = useRef(new Set<string>());
  const sendMessage = useCallback(
    async (chatId: string, text: string, partnerId?: string, retryId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const accountId = myIdRef.current;
      const localId = retryId || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      if (sendsInFlight.current.has(localId)) return;
      if (retryId && messagesRef.current[chatId]?.find(m => m.id === retryId)?.deliveryStatus !== 'failed') {
        throw new Error('Refresh the conversation to confirm this message before retrying.');
      }
      sendsInFlight.current.add(localId);
      const local: Message = { id: localId, chatId, senderId: myMemberIdRef.current || accountId,
        text: trimmed, createdAt: Date.now(), deliveryStatus: 'sending' };
      setMessages(prev => ({ ...prev, [chatId]: [...(prev[chatId] ?? []).filter(m => m.id !== localId), local] }));
      let requestStarted = false;
      try {
        // The server stores only ciphertext. Prefer the member/account id from
        // the conversation record because a profile id derives a different key.
        const chat = chatsRef.current.find(c => String(c.id) === String(chatId));
        if (chat?.connectionClosed) throw new Error('This match has been removed.');
        let senderId = myMemberIdRef.current;
        if (!senderId) {
          // After a cold restore, React state can briefly contain a profile ID.
          // Read the JWT once so a message can never be encrypted with that ID.
          const stored = await loadTokens();
          senderId = stored?.accessToken
            ? getMemberUserIdFromToken(stored.accessToken) ?? ''
            : '';
        }
        senderId = senderId || await waitForMessagingCryptoReady() || '';
        const conversationPartnerId = chat?.participantIds?.find(
          id => id && id !== senderId && id !== myIdRef.current && id !== 'CURRENT_USER_PLACEHOLDER',
        );
        const encryptionPartnerId =
          chat?.otherProfile?.userId ||
          conversationPartnerId ||
          partnerId ||
          chat?.otherProfile?.id;

        if (
          !senderId ||
          !encryptionPartnerId ||
          encryptionPartnerId === 'CURRENT_USER_PLACEHOLDER'
        ) {
          throw new Error(
            'Secure messaging is not ready yet. Please try again in a moment.',
          );
        }

        // Require the same secure server storage contract for text and stickers.
        const wireText = await encryptMessageForChat(
          trimmed,
          senderId,
          encryptionPartnerId,
        );

        // A successful socket.send only confirms a local buffer write. Use the
        // server's persisted message response before declaring delivery successful.
        if (chatsRef.current.find(item => String(item.id) === String(chatId))?.connectionClosed) {
          throw new Error('This match has been removed.');
        }
        if (accountId !== myIdRef.current) throw new Error('The signed-in account changed.');
        requestStarted = true;
        const saved = await ChatService.sendMessage(chatId, wireText, encryptionPartnerId);
        if (accountId !== myIdRef.current) return;
        const message = { ...saved, chatId, text: trimmed, deliveryStatus: saved.deliveryStatus || 'sent' as const };
        setMessages(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] ?? []).filter(item => item.id !== message.id && item.id !== localId), message],
        }));
        setChats(prev => prev.map(item => item.id === chatId ? {
          ...item, lastMessage: trimmed, lastMessageAt: message.createdAt,
        } : item));
      } catch (error) {
        if (accountId === myIdRef.current) setMessages(prev => ({ ...prev,
          [chatId]: (prev[chatId] ?? []).map(m => m.id === localId ? { ...m, deliveryStatus: failureDelivery(error, requestStarted) } : m),
        }));
        if (error && typeof error === 'object') Object.assign(error, {
          localMessageId: localId, deliveryUnconfirmed: failureDelivery(error, requestStarted) === 'unconfirmed',
        });
        throw error;
      } finally { sendsInFlight.current.delete(localId); }
    },
    // Refs are stable (never recreated) so listing them does not cause re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cryptoMyId, myMemberId],
  );

  const dismissLocalMessage = useCallback((chatId: string, messageId: string) => {
    const prev = messagesRef.current;
    const next = { ...prev, [chatId]: (prev[chatId] ?? []).filter(message =>
      !(message.id === messageId && message.id.startsWith('local-') &&
        (message.deliveryStatus === 'failed' || message.deliveryStatus === 'unconfirmed'))),
    };
    messagesRef.current = next;
    setMessages(next);
    if (myIdRef.current) persistMessages(next, myIdRef.current);
  }, []);

  // ─── WebSocket Message Handler ───────────────────────────────────────────

  // ─── Load Chat Messages ───────────────────────────────────────────────────
  // Called when user opens a chat screen (ChatScreen mounts)
  const loadChatMessages = useCallback(
    async (chatId: string, partnerId?: string, olderCursor?: string) => {
      if (loadingChatsRef.current.has(chatId)) return;
      loadingChatsRef.current.add(chatId);
      const accountId = myIdRef.current;
      updateHistory(chatId, olderCursor ? { loading: true, error: undefined } : { loading: true });
      try {
        const chat = chatsRef.current.find(c => c.id === chatId);
        const partnerMemberId = chat?.otherProfile?.userId;
        let resolvedPartner = partnerMemberId || partnerId;
        if (
          !resolvedPartner ||
          resolvedPartner === 'CURRENT_USER_PLACEHOLDER'
        ) {
          resolvedPartner = partnerId;
        }
        let memberId = await waitForMessagingCryptoReady();
        if (!memberId) {
          memberId = myMemberIdRef.current || currentUser?.id || currentUser?.profile?.userId || currentUser?.profile?.id || null;
        }
        if (!memberId) throw new Error('Messaging is not ready. Please try again.');
        const page = await ChatService.getMessagePage(chatId, memberId, resolvedPartner ?? chatId, olderCursor);
        if (accountId !== myIdRef.current) return;
        const msgs = page.messages;
        if (olderCursor) {
          const seen = historyCursorsRef.current[chatId] ?? new Set<string>();
          seen.add(olderCursor);
          historyCursorsRef.current[chatId] = seen;
          updateHistory(chatId, { next: page.next && !seen.has(page.next) ? page.next : null, loadedOlder: true, error: undefined });
        } else if (!historyPagesRef.current[chatId]?.loadedOlder) {
          updateHistory(chatId, { next: page.next, error: undefined });
        }

        setMessages(prev => {
          const prevList = prev[chatId] ?? [];
          const merged = [...prevList];
          let hasDiff = false;
          msgs.forEach(m => {
            const idx = merged.findIndex(em => em.id === m.id);
            if (idx === -1) {
              merged.push(m);
              hasDiff = true;
            } else if (merged[idx].text !== m.text || merged[idx].deliveryStatus !== m.deliveryStatus) {
              merged[idx] = m;
              hasDiff = true;
            }
          });
          if (!hasDiff && prevList.length === merged.length) return prev;
          return { ...prev, [chatId]: merged };
        });

        if (!olderCursor && msgs.length > 0) {
          const latest = msgs.reduce((a, b) =>
            a.createdAt > b.createdAt ? a : b,
          );
          const latestText = latest.text;
          if (latestText) {
            setChats(prev => {
              const current = prev.find(c => c.id === chatId);
              if (
                !current ||
                (current.lastMessage === latestText &&
                  current.lastMessageAt === latest.createdAt)
              ) {
                return prev;
              }
              return prev.map(c =>
                c.id === chatId
                  ? {
                      ...c,
                      lastMessage: latestText,
                      lastMessageAt: latest.createdAt,
                    }
                  : c,
              );
            });
          }
        }
      } catch (err) {
        if (olderCursor && accountId === myIdRef.current) updateHistory(chatId, { error: 'Could not load more history. Tap to retry.' });
        throw err;
      } finally {
        loadingChatsRef.current.delete(chatId);
        if (accountId === myIdRef.current) updateHistory(chatId, { loading: false });
      }
    },
    // cryptoMyId / myMemberId stabilise after login; listing them ensures the
    // callback always uses the freshest member id for E2EE key derivation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cryptoMyId, myMemberId, updateHistory],
  );

  const loadOlderChatMessages = useCallback(async (chatId: string, partnerId?: string) => {
    const cursor = historyPagesRef.current[chatId]?.next;
    if (!cursor || loadingChatsRef.current.has(chatId)) return;
    await loadChatMessages(chatId, partnerId, cursor);
  }, [loadChatMessages]);

  const getChatHistoryState = useCallback((chatId: string) =>
    historyPages[chatId] ?? { next: null, loading: false }, [historyPages]);

  const connectToChat = useLatestCallback(
    (
      chatId: string,
      partnerId?: string,
      onTyping?: (isTyping: boolean) => void,
      onPresence?: (isOnline: boolean) => void,
    ) => {
      // Mark this chat as the one the user has open — suppresses in-app notifications
      activeChatIdRef.current = chatId;
      setActiveChatId(chatId);

      const chat = chatsRef.current.find(c => c.id === chatId);
      const partnerMemberId = chat?.otherProfile?.userId;
      const conversationPartnerId = chat?.participantIds?.find(
        id => id && id !== myMemberIdRef.current && id !== myIdRef.current && id !== 'CURRENT_USER_PLACEHOLDER',
      );
      let resolvedPartner =
        partnerMemberId || conversationPartnerId || partnerId;
      if (!resolvedPartner || resolvedPartner === 'CURRENT_USER_PLACEHOLDER') {
        resolvedPartner = chat?.otherProfile?.id || partnerId;
      }

      chatWsClient.connect(
        chatId,
        async msg => {
          // If the message is already plaintext (new mobile messages), use it directly.
          let displayText: string;
          const rawText = msg.text ?? '';
          if (rawText.includes('__E2EE__:') || rawText.includes('"iv":')) {
            displayText = await smartDecryptText(
              rawText,
              cryptoMyIdRef.current,
              resolvedPartner ?? chatId,
              chatId,
              String(msg.senderId ?? ''),
              String(
                msg.senderId !== cryptoMyIdRef.current
                  ? cryptoMyIdRef.current
                  : resolvedPartner ?? chatId,
              ),
            );
            if (
              displayText === E2EE_DECRYPT_FAILED ||
              displayText.startsWith('__E2EE__:')
            ) {
              displayText = 'Message unavailable';
            }
          } else {
            displayText = rawText;
          }
          if (activeChatIdRef.current !== chatId) return;
          const stored = { ...msg, text: displayText };

          setMessages(prev => {
            const existing = prev[chatId] || [];
            // If exact server ID already present, skip (idempotent)
            if (
              existing.some(m => m.id === stored.id && !m.id.startsWith('opt-'))
            )
              return prev;
            return { ...prev, [chatId]: [...existing, stored] };
          });
          setChats(prevChats => {
            const chatIdx = prevChats.findIndex(c => c.id === chatId);
            if (chatIdx === -1) return prevChats;
            const current = prevChats[chatIdx];
            if (
              current.lastMessage === displayText &&
              current.lastMessageAt === stored.createdAt
            ) {
              return prevChats;
            }
            const newChats = [...prevChats];
            newChats[chatIdx] = {
              ...newChats[chatIdx],
              lastMessage: displayText,
              lastMessageAt: stored.createdAt,
            };
            return newChats;
          });
        },
        status => {
          if (status === 'connected') loadChatMessages(chatId, resolvedPartner).catch(() => {});
          if (status === 'error' || status === 'disconnected') {
            console.warn(`[AppData] WS ${status} for chat ${chatId}`);
          }
        },
        onTyping,
        onPresence,
        resolvedPartner,
      );

      // REST polling fallback — only fires when WS is unavailable
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }

      const pollFunc = () => {
        if (AppState.currentState !== 'active' || chatWsClient.isConnected) return;
        loadChatMessages(chatId, resolvedPartner).catch(() => {
          // The next foreground fallback may recover; retain loaded history.
        });
      };
      pollTimerRef.current = setInterval(pollFunc, 10000);
    },
  );

  const markChatAsRead = useCallback((chatId: string, partnerId?: string) => {
    setChats(prev =>
      prev.map(c => (c.id === chatId ? { ...c, unreadCount: 0 } : c)),
    );
    chatWsClient.sendReadReceipt();
    ChatService.markAsRead(chatId, partnerId).catch(() => {});
  }, []);

  const disconnectFromChat = useCallback(() => {
    // Clear the active chat ref so future background notifications work normally
    activeChatIdRef.current = null;
    setActiveChatId(null);
    chatWsClient.disconnect();
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ─── Block / Unblock ──────────────────────────────────────────────────────
  const loadBlockedUsers = async () => {
    try {
      const blocked = await blockService.getBlockedUsers();
      setBlockedIds(new Set(blocked.map(p => p.id)));
    } catch (e) {
      console.warn('[AppData] Could not load blocked users:', e);
    }
  };

  const blockUser = useCallback(async (profileId: string) => {
    // Optimistic update
    setBlockedIds(prev => new Set([...prev, profileId]));
    try {
      await blockService.blockUser(profileId);
    } catch (e) {
      // Rollback
      setBlockedIds(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      throw e;
    }
  }, []);

  const unblockUser = useCallback(async (profileId: string) => {
    // Optimistic update
    setBlockedIds(prev => {
      const next = new Set(prev);
      next.delete(profileId);
      return next;
    });
    try {
      await blockService.unblockUser(profileId);
    } catch (e) {
      // Rollback
      setBlockedIds(prev => new Set([...prev, profileId]));
      throw e;
    }
  }, []);

  const isBlockedByMe = useCallback(
    (profileId: string) => blockedIds.has(profileId),
    [blockedIds],
  );

  const isUserMuted = useCallback(
    (userId: string) => mutedUserIds.has(userId),
    [mutedUserIds],
  );

  const toggleMuteUser = useCallback(
    async (userId: string, alternateId?: string): Promise<boolean> => {
      const isCurrentlyMuted =
        mutedUserIds.has(userId) ||
        Boolean(alternateId && mutedUserIds.has(alternateId));
      const next = new Set(mutedUserIds);
      for (const id of [userId, alternateId]) {
        if (!id) continue;
        if (isCurrentlyMuted) next.delete(id);
        else next.add(id);
      }
      if (myId) {
        await setItem(
          accountStorageKey(StorageKeys.MUTED_USERS, myId),
          Array.from(next),
        );
      }
      setMutedUserIds(next);
      return !isCurrentlyMuted;
    },
    [mutedUserIds, myId],
  );

  // Filter out chats with blocked users
  const myChats = useMemo(
    () => chats.filter(c => !blockedIds.has(c.otherProfile?.id ?? '')),
    [chats, blockedIds],
  );

  // ─── Shortlist (synced with Django /api/v1/shortlists/) ─────────────────────
  const loadShortlists = useCallback(async () => {
    try {
      const serverProfiles = await InterestService.getShortlists();
      setShortlistedProfilesList(serverProfiles);
      const ids = serverProfiles.map(p => p.id);
      setShortlist(ids);
      if (myId)
        await setItem(accountStorageKey(StorageKeys.SHORTLIST, myId), ids);
      const cache: Record<string, Profile> = {};
      serverProfiles.forEach(p => {
        cache[p.id] = p;
      });
      setProfileCache(prev => ({ ...prev, ...cache }));
    } catch (e) {
      console.warn('[AppData] Could not load shortlists from server:', e);
      const stored = myId
        ? (await getItem<string[]>(
            accountStorageKey(StorageKeys.SHORTLIST, myId),
          )) ?? []
        : [];
      setShortlist(stored);
    }
  }, [myId]);

  const toggleShortlist = useCallback(
    async (profileId: string) => {
      
      const willBeShortlisted = !shortlist.includes(profileId);
      const next = willBeShortlisted
        ? [...shortlist, profileId]
        : shortlist.filter(id => id !== profileId);

      setShortlist(next);
      if (myId)
        await setItem(accountStorageKey(StorageKeys.SHORTLIST, myId), next);

      try {
        await InterestService.toggleShortlistApi(profileId);
        // Sync in background — no await so there's no UI flicker/stall
        loadShortlists().catch(() => {});
      } catch {
        setShortlist(shortlist);
        if (myId) {
          await setItem(
            accountStorageKey(StorageKeys.SHORTLIST, myId),
            shortlist,
          );
        }
        Alert.alert(
          'Could not save',
          'Your shortlist was not changed. Please try again.',
        );
        return;
      }
      await loadShortlists();
    },
    [shortlist, loadShortlists, myId],
  );

  const isShortlisted = useCallback(
    (profileId: string) => shortlist.includes(profileId),
    [shortlist],
  );

  const shortlistedProfiles = useMemo(() => {
    if (shortlistedProfilesList.length > 0) return shortlistedProfilesList;
    const all = [...discoverProfiles];
    const seen = new Set<string>();
    return all.filter(p => {
      if (!shortlist.includes(p.id) || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [shortlistedProfilesList, shortlist, discoverProfiles]);

  // ─── Server-side Filtering ────────────────────────────────────────────────
  const filterProfiles = useCallback(
    (options: FilterOptions): Profile[] => {
      // If backend already filtered, just return discoverProfiles directly.
      // This is local post-filter for immediate UI response.
      return discoverProfiles.filter(p => {
        if (
          options.gender &&
          options.gender !== 'all' &&
          p.gender !== options.gender
        ) {
          return false;
        }
        if (options.minAge && p.age < options.minAge) return false;
        if (options.maxAge && p.age > options.maxAge) return false;
        if (
          options.city &&
          !p.city.toLowerCase().includes(options.city.toLowerCase())
        ) {
          return false;
        }
        if (
          options.religion &&
          options.religion !== 'All' &&
          p.religion !== options.religion
        ) {
          return false;
        }
        if (
          options.profession &&
          !p.profession.toLowerCase().includes(options.profession.toLowerCase())
        ) {
          return false;
        }
        if (options.verifiedOnly && !p.isVerified) return false;
        return true;
      });
    },
    [discoverProfiles],
  );

  useEffect(() => {
    if (!currentUser?.id) return;

    const intervalId = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      loadInterests();
      loadChats();
    }, 15000); // 15-second background sync fallback (WebSocket handles real-time updates)

    return () => clearInterval(intervalId);
  }, [currentUser?.id, cryptoMyId, loadInterests, loadChats]); // Include cryptoMyId so it captures the loaded member ID

  const refreshInterests = useCallback(async () => {
    await loadInterests();
  }, [loadInterests]);

  const refreshChats = useCallback(async () => {
    await loadChats();
  }, [loadChats]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadDiscoverProfiles(), loadInterests(), loadChats(), refreshCurrentUser()]);
  }, [loadDiscoverProfiles, loadInterests, loadChats, refreshCurrentUser]);

  // ─── Instant App Foreground & Real-Time Push Event Sync ───────────────────
  useEffect(() => {
    const handleActiveSync = () => {
      if (currentUser && myIdRef.current) {
        // Instant rehydration of background-received messages, chats, and interests
        getItem<Record<string, Message[]>>(accountStorageKey(StorageKeys.MESSAGES, myIdRef.current)).then(
          cached => {
            if (cached) setMessages(prev => {
              const restored = restoreMessageDelivery(cached);
              const merged = { ...prev };
              for (const [id, rows] of Object.entries(restored)) {
                // Cached local cards can predate a successful send or dismissal.
                // Only a cold restore should resurrect an interrupted local send.
                const byId = new Map(rows.filter(m => !m.id.startsWith('local-')).map(m => [m.id, m]));
                for (const m of prev[id] ?? []) byId.set(m.id, m);
                merged[id] = [...byId.values()];
              }
              return merged;
            });
          },
        );
        getItem<Chat[]>(accountStorageKey(StorageKeys.CHATS, myIdRef.current)).then(
          cached => {
            if (cached && cached.length > 0) {
              setChats(cached);
              chatsRef.current = cached;
            }
          },
        );
        getItem<CachedInterests>(accountStorageKey(StorageKeys.INTERESTS, myIdRef.current)).then(
          cached => {
            if (cached) {
              if (cached.sent?.length) setSentInterestsList(cached.sent);
              if (cached.received?.length) setReceivedInterestsList(cached.received);
              if (cached.merged?.length) setInterests(cached.merged);
            }
          },
        );

        loadInterests();
        loadChats();
        loadDiscoverProfiles();
      }
    };

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        handleActiveSync();
      } else if (nextAppState === 'background' || nextAppState === 'inactive') {
        // App backgrounded: immediately flush in-memory data to local storage
        if (myIdRef.current) {
          persistChats(chatsRef.current, myIdRef.current);
          persistInterests(
            {
              sent: sentInterestsListRef.current,
              received: receivedInterestsListRef.current,
              merged: interestsRef.current,
            },
            myIdRef.current,
          );
          persistMessages(messagesRef.current, myIdRef.current);
          persistDiscoverProfiles(discoverProfilesRef.current, myIdRef.current);
          persistProfileCache(profileCacheRef.current, myIdRef.current);
        }
      }
    });

    const sub1 = DeviceEventEmitter.addListener('REFRESH_INTERESTS', () => {
      loadInterests();
    });
    const sub2 = DeviceEventEmitter.addListener('REFRESH_CHATS', () => {
      loadChats();
    });
    const sub3 = DeviceEventEmitter.addListener('REFRESH_APP_DATA', () => {
      loadInterests();
      loadChats();
      refreshCurrentUser();
      loadDiscoverProfiles();
    });

    return () => {
      subscription.remove();
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, [
    currentUser,
    refreshCurrentUser,
    loadInterests,
    loadChats,
    loadDiscoverProfiles,
  ]);

  const value = useMemo(
    () => ({
      allProfiles,
      discoverProfiles,
      isLoadingProfiles,
      profilesError,
      interestsError,
      chatsError,
      getProfileById,
      sentInterests,
      receivedInterests,
      sendInterest,
      cancelInterest,
      respondToInterest,
      interestStatusFor,
      getSentInterestTo,
      getReceivedInterestFrom,
      getInterestRelationship,
      chats: myChats,
      getMessagesForChat,
      loadChatMessages,
      loadOlderChatMessages,
      getChatHistoryState,
      connectToChat,
      disconnectFromChat,
      getOrCreateChatWith,
      sendMessage,
      dismissLocalMessage,
      getOtherParticipantId,
      shortlistedIds: shortlist,
      shortlistedProfiles,
      toggleShortlist,
      isShortlisted,
      filterProfiles,
      refreshDiscoverProfiles,
      refreshInterests,
      refreshChats,
      refreshAll,
      totalUnreadCount: myChats.reduce(
        (sum, c) => sum + (c.unreadCount ?? 0),
        0,
      ),
      markChatAsRead,
      isIncognitoMode,
      setIncognitoMode,
      clearedNotificationIds,
      clearNotifications,
      cryptoMyId,
      blockedIds,
      blockUser,
      unblockUser,
      isBlockedByMe,
      mutedUserIds,
      toggleMuteUser,
      isUserMuted,
    }),
    [
      allProfiles,
      discoverProfiles,
      isLoadingProfiles,
      profilesError,
      interestsError,
      chatsError,
      getProfileById,
      sentInterests,
      receivedInterests,
      sendInterest,
      cancelInterest,
      respondToInterest,
      interestStatusFor,
      getSentInterestTo,
      getReceivedInterestFrom,
      getInterestRelationship,
      myChats,
      getMessagesForChat,
      loadChatMessages,
      loadOlderChatMessages,
      getChatHistoryState,
      connectToChat,
      disconnectFromChat,
      getOrCreateChatWith,
      sendMessage,
      dismissLocalMessage,
      getOtherParticipantId,
      shortlist,
      shortlistedProfiles,
      toggleShortlist,
      isShortlisted,
      filterProfiles,
      refreshDiscoverProfiles,
      refreshInterests,
      refreshChats,
      refreshAll,
      markChatAsRead,
      isIncognitoMode,
      clearedNotificationIds,
      clearNotifications,
      cryptoMyId,
      blockedIds,
      blockUser,
      unblockUser,
      isBlockedByMe,
      mutedUserIds,
      toggleMuteUser,
      isUserMuted,
    ],
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within an AppDataProvider');
  }
  return ctx;
}
