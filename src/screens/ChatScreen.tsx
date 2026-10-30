// @refresh reset
function isRemovedMatch(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === 'match_removed' || value?.message === 'This match has been removed.';
}

import BufferingIndicator from '../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React,{ useCallback,useEffect,useLayoutEffect,useRef,useState } from 'react';
import TypingIndicator from '../components/TypingIndicator';
import QuickReplyBar from '../components/QuickReplyBar';
import {
  Alert,
  Animated,
  AppState,
  DeviceEventEmitter,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { ShieldCheck } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { blockService } from '../api/blockService';
import { ReportTarget } from '../api/safetyService';
import { chatWsClient } from '../api/wsClient';
import AuthImage from '../components/AuthImage';
import SafetyCenter from '../components/SafetyCenter';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { usePersistentDraft } from '../hooks/usePersistentDraft';
import { accountStorageKey, getItem, setItem } from '../utils/storage';
import { subscribeToPresence } from '../services/PresenceService';
import { Message } from '../types/models';
import { parseStickerMessage } from '../utils/chatContent';
import { triggerHaptic } from '../utils/haptics';
import { usePlanAllowance } from '../utils/planAllowance';
import analyticsService from '../services/analyticsService';
import AnimatedButton from '../components/AnimatedButton';
import { recordConversation } from '../utils/inAppRating';
import { useReducedMotion } from '../hooks/useReducedMotion';

const EMOJI_CATEGORIES = [
  {
    id: 'quick',
    label: 'Quick',
    emojis: [
      '😊',
      '😂',
      '🥺',
      '😍',
      '🥰',
      '🙏',
      '👍',
      '❤️',
      '🔥',
      '💖',
      '🎉',
      '👋',
    ],
  },
  {
    id: 'smileys',
    label: 'Smileys',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '🤣',
      '😉',
      '😊',
      '🙂',
      '🙃',
      '😌',
      '😎',
      '🤗',
      '🤩',
      '🥳',
      '😇',
    ],
  },
  {
    id: 'love',
    label: 'Love',
    emojis: [
      '❤️',
      '🩷',
      '💖',
      '💕',
      '💗',
      '💓',
      '💘',
      '💝',
      '😘',
      '🥰',
      '😍',
      '💋',
      '🌹',
      '💍',
      '🫶',
      '🤍',
    ],
  },
  {
    id: 'feelings',
    label: 'Feelings',
    emojis: [
      '🥺',
      '😢',
      '😭',
      '😔',
      '😞',
      '😤',
      '😡',
      '🤔',
      '🙄',
      '😳',
      '🤭',
      '🫣',
      '🤞',
      '👏',
      '🙌',
      '🤝',
    ],
  },
  {
    id: 'celebrate',
    label: 'Fun',
    emojis: [
      '🎉',
      '🎊',
      '💐',
      '⭐',
      '🌈',
      '☀️',
      '☕',
      '🍰',
      '🎂',
      '🎁',
      '🥂',
      '💃',
      '🕺',
      '🎵',
      '🚀',
      '🍀',
    ],
  },
] as const;

type ComposerPanel = 'emoji' | null;
type EmojiCategoryId = (typeof EMOJI_CATEGORIES)[number]['id'];

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

function formatBubbleTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderDeliveryStatusIcon(status?: Message['deliveryStatus']) {
  switch (status) {
    case 'sending':
      return <Icon name="time-outline" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    case 'read':
      return <Icon name="checkmark-done" size={14} color="#67E8F9" style={{ marginLeft: 4 }} />;
    case 'delivered':
      return <Icon name="checkmark-done" size={14} color="rgba(255,255,255,0.85)" style={{ marginLeft: 4 }} />;
    case 'failed':
      return <Icon name="alert-circle" size={12} color="#FEE2E2" style={{ marginLeft: 4 }} />;
    case 'unconfirmed':
      return <Icon name="help-circle-outline" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
    case 'sent':
    default:
      return <Icon name="checkmark" size={13} color="rgba(255,255,255,0.85)" style={{ marginLeft: 4 }} />;
  }
}

function AnimatedDeliveryStatusIcon({ status }: { status?: Message['deliveryStatus'] }) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.7)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0.4)).current;

  useEffect(() => {
    if (reduced) return;
    scale.setValue(0.7);
    opacity.setValue(0.4);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, reduced, scale, opacity]);

  return (
    <Animated.View style={{ transform: [{ scale }], opacity }}>
      {renderDeliveryStatusIcon(status)}
    </Animated.View>
  );
}

function AnimatedMessageRow({ children, isMine }: { children: React.ReactNode; isMine: boolean }) {
  const reduced = useReducedMotion();
  const enterAnim = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      enterAnim.setValue(1);
      return;
    }
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [reduced, enterAnim]);

  const translateY = enterAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0],
  });

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isMine ? styles.rowMine : styles.rowTheirs,
        {
          opacity: enterAnim,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function formatDaySeparator(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export default function ChatScreen({ route, navigation, embedded = false }: Props & { embedded?: boolean }) {
  const { width, height } = useWindowDimensions();
  const isLarge = width >= 640;
  const { chatId, otherProfileId, fallbackName, fallbackPhoto } = route.params;
  const {
    chats,
    getInterestRelationship,
    cancelInterest,
    getProfileById,
    getMessagesForChat,
    sendMessage,
    dismissLocalMessage,
    loadChatMessages,
    loadOlderChatMessages,
    getChatHistoryState,
    connectToChat,
    disconnectFromChat,
    markChatAsRead,
    isBlockedByMe,
    blockUser,
    unblockUser,
    toggleMuteUser,
    isUserMuted,
  } = useAppData();
  const { currentUser } = useAuth();
  const { isPremium } = usePlanAllowance();
  const [draft, setDraft] = usePersistentDraft(
    currentUser?.id ? accountStorageKey(`@mdp/chat-draft-v1:${encodeURIComponent(chatId)}`, currentUser.id) : null,
    { text: '' },
  );
  const text = draft.text;
  const setText = (action: React.SetStateAction<string>) => setDraft(previous => ({
    text: typeof action === 'function' ? action(previous.text) : action,
  }));
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [composerPanel, setComposerPanel] = useState<ComposerPanel>(null);
  const [emojiCategoryId, setEmojiCategoryId] = useState<EmojiCategoryId>(
    EMOJI_CATEGORIES[0].id,
  );
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState<boolean | null>(null);
  const [safetyMinimized, setSafetyMinimized] = useState(false);

  useEffect(() => {
    let active = true;
    getItem<boolean>('@mdp/safety_notice_minimized').then(val => {
      if (active && typeof val === 'boolean') {
        setSafetyMinimized(val);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleSafetyNotice = () => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSafetyMinimized(prev => {
      const next = !prev;
      setItem('@mdp/safety_notice_minimized', next).catch(() => {});
      return next;
    });
  };
  const blockRequestRevision = useRef(0);
  const [matchRemoved, setMatchRemoved] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const show = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const otherProfile = getProfileById(otherProfileId);
  const messages = getMessagesForChat(chatId);
  const [loadingMessages, setLoadingMessages] = useState(messages.length === 0);
  const [messageError, setMessageError] = useState<string | null>(null);
  const hasMessagesRef = useRef(messages.length > 0);
  const nearBottomRef = useRef(true);
  const lastDisplayedMessageRef = useRef<string | undefined>(undefined);
  const history = getChatHistoryState(chatId);
  const latestMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    nearBottomRef.current = true;
    lastDisplayedMessageRef.current = undefined;
  }, [chatId]);

  // Earlier pages must not pull the reader back to the newest message.
  useEffect(() => {
    hasMessagesRef.current = messages.length > 0;
    const changedLatest = lastDisplayedMessageRef.current !== latestMessageId;
    lastDisplayedMessageRef.current = latestMessageId;
    if (messages.length > 0 && changedLatest && nearBottomRef.current) {
      const timer = setTimeout(() => {
        if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [chatId, messages.length, latestMessageId]);

  // Is this person blocked by ME?
  const iBlocked = isBlockedByMe(otherProfileId);
  // Is this person/conversation muted?
  const isMuted = isUserMuted(otherProfileId) || isUserMuted(chatId);
  // Either side blocked = disable chat
  const currentChat = chats?.find(chat => String(chat.id) === String(chatId));
  const relationship = getInterestRelationship?.(otherProfileId);
  const previousClosed = useRef(currentChat?.connectionClosed);
  useEffect(() => {
    if (previousClosed.current === true && currentChat?.connectionClosed === false) {
      setMatchRemoved(false);
      setMessageError(null);
    }
    previousClosed.current = currentChat?.connectionClosed;
  }, [currentChat?.connectionClosed, chatId]);
  useEffect(() => { setMatchRemoved(false); }, [chatId]);
  const connectionClosed = matchRemoved || !!currentChat?.connectionClosed;
  const chatDisabled = iBlocked || blockedByThem || connectionClosed || !isPremium;
  useEffect(() => {
    if (connectionClosed) {
      setComposerPanel(null);
      setPartnerTyping(false);
      disconnectFromChat();
    }
  }, [connectionClosed, disconnectFromChat]);

  useEffect(() => {
    markChatAsRead(chatId, otherProfileId);
  }, [chatId, otherProfileId, markChatAsRead]);

  // Optional block lookup is not a transport health check. Unknown results
  // must not imply a failed chat connection or a confirmed unblock.
  const refreshBlockStatus = useCallback(async () => {
    const revision = ++blockRequestRevision.current;
    try {
      const result = await blockService.checkIfBlockedBy(otherProfileId);
      if (revision === blockRequestRevision.current) setBlockedByThem(result);
    } catch {
      if (revision === blockRequestRevision.current) setBlockedByThem(null);
    }
  }, [otherProfileId]);

  useEffect(() => {
    setBlockedByThem(null);
    refreshBlockStatus();
    return () => { blockRequestRevision.current += 1; };
  }, [refreshBlockStatus]);

  const myId = currentUser?.id ?? 'me';
  const myMemberId = currentUser?.profile?.id ?? 'me';

  const displayName = otherProfile?.name || fallbackName || 'Chat';
  const displayPhoto = otherProfile?.photo || fallbackPhoto;

  const [partnerOnline, setPartnerOnline] = useState(false);
  useEffect(() => {
    setPartnerOnline(false);
    const memberId = otherProfile?.userId || otherProfileId;
    if (memberId) return subscribeToPresence(memberId, setPartnerOnline);
  }, [otherProfile?.userId, otherProfileId]);
  const isOnline = partnerOnline;

  React.useEffect(() => {
    let isMounted = true;
    const refresh = async () => {
      try {
        await loadChatMessages(chatId, otherProfileId);
        if (isMounted) setMessageError(null);
      } catch (error) {
        if (isMounted && isRemovedMatch(error)) setMatchRemoved(true);
        if (isMounted && isPremium) setMessageError('Could not load messages. Pull down to retry.');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };
    const connect = () => {
      if (connectionClosed) return;
      connectToChat(chatId, otherProfileId, setPartnerTyping);
      refresh();
    };
    if (!hasMessagesRef.current) {
      setLoadingMessages(true);
    }
    connect();
    const refreshSub = DeviceEventEmitter.addListener('REFRESH_ACTIVE_CHAT', (id?: string) => {
      if (!id || String(id) === String(chatId)) refresh();
    });
    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') connect();
      else {
        disconnectFromChat();
        setPartnerTyping(false);
      }
    });
    return () => {
      isMounted = false;
      clearTimeout(typingTimerRef.current ?? undefined);
      refreshSub.remove();
      appStateSub.remove();
      disconnectFromChat();
    };
  }, [chatId, otherProfileId, loadChatMessages, connectToChat, disconnectFromChat, connectionClosed, isPremium]);

  useLayoutEffect(() => {
    if (!embedded) navigation.setOptions({ headerShown: false });
  }, [navigation, embedded]);

  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    chatWsClient.sendTyping(false);
  };

  const signalTyping = () => {
    if (!isPremium) return;
    chatWsClient.sendTyping(true);
    
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      chatWsClient.sendTyping(false);
      typingTimerRef.current = null;
    }, 3000);
  };

  const handleTextChange = (val: string) => {
    const nextText = val.slice(0, 500);
    setText(nextText);
    if (nextText) {
      signalTyping();
    } else {
      stopTyping();
    }
  };

  const appendEmoji = (emoji: string) => {
    setText(currentText => `${currentText}${emoji}`.slice(0, 500));
    signalTyping();
    triggerHaptic('light');
  };

  const toggleComposerPanel = (panel: Exclude<ComposerPanel, null>) => {
    Keyboard.dismiss();
    setComposerPanel(currentPanel => (currentPanel === panel ? null : panel));
  };

  const sendContent = async (content: string, restoreTextOnFailure = false, retryId?: string) => {
    const toSend = content.trim();
    if (!toSend || sending || chatDisabled) return;

    if (!isPremium) {
      Alert.alert(
        'Premium Required',
        'Chatting is reserved for Premium members. Upgrade to Gold or Elite to start chatting.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade to Gold',
            onPress: () => navigation.navigate('Membership'),
          },
        ],
      );
      return;
    }

    stopTyping();
    triggerHaptic(parseStickerMessage(toSend) ? 'medium' : 'light');
    if (restoreTextOnFailure) setText('');
    setSending(true);
    setComposerPanel(null);
    const isFirstMessage = messages.length === 0;
    try {
      if (retryId) await sendMessage(chatId, toSend, otherProfileId, retryId);
      else await sendMessage(chatId, toSend, otherProfileId);
      if (isFirstMessage) {
        analyticsService.trackConversationStarted().catch(() => {});
        recordConversation().catch(() => {});
      }
    } catch (err: any) {
      if (restoreTextOnFailure && !err?.localMessageId) setText(toSend);
      // Plan and permission denials also use 403. Only disable the chat when
      // the block endpoint confirms that the partner actually blocked us.
      if (isRemovedMatch(err)) setMatchRemoved(true);
      else if (err?.status === 403 && err?.code === 'blocked_by_user') {
        blockRequestRevision.current += 1;
        setBlockedByThem(true);
      }
      else if (err?.status === 403) {
        await refreshBlockStatus();
      }
      Alert.alert(
        err?.deliveryUnconfirmed ? 'Message status unknown' : 'Couldn’t send message',
        err?.deliveryUnconfirmed ? 'The server may have saved this message. Refresh the conversation before sending it again.' : err?.message || (!isPremium ? 'Your premium plan has ended. Upgrade to continue chatting.' : 'Please check your connection and try again.'),
      );
    } finally {
      setSending(false);
    }
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
  };

  const onSend = () => sendContent(text, true);

  const handleBlockToggle = () => {
    if (iBlocked) {
      Alert.alert(
        'Unblock Member',
        `Are you sure you want to unblock ${displayName}? They will be able to message you again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: async () => {
              try {
                await unblockUser(otherProfileId);
              } catch {
                Alert.alert('Error', 'Failed to unblock. Please try again.');
              }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Block Member',
        `Are you sure you want to block ${displayName}? They will no longer be able to see your profile or message you.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Block',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(otherProfileId);
              } catch {
                Alert.alert('Error', 'Failed to block. Please try again.');
              }
            },
          },
        ],
      );
    }
  };

  const handleMenuPress = () => {
    setShowMenu(true);
  };

  const handleMuteToggle = async () => {
    setShowMenu(false);
    const nowMuted = await toggleMuteUser(otherProfileId, chatId);
    Alert.alert(
      nowMuted ? 'Notifications Muted' : 'Notifications Unmuted',
      nowMuted
        ? `You will no longer receive notifications for messages from ${displayName}.`
        : `You will now receive notifications for messages from ${displayName}.`,
    );
  };

  type ListItem =
    | { type: 'separator'; date: string; key: string }
    | { type: 'message'; msg: Message; showAvatar: boolean; key: string };

  const listItems: ListItem[] = [];
  messages.forEach((msg, i) => {
    const prev = messages[i - 1];
    if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
      listItems.push({
        type: 'separator',
        date: formatDaySeparator(msg.createdAt),
        key: `sep-${msg.id}`,
      });
    }
    const isMine = msg.senderId === myId || msg.senderId === myMemberId;
    const nextMsg = messages[i + 1];
    const showAvatar =
      !isMine &&
      (!nextMsg ||
        nextMsg.senderId !== msg.senderId ||
        !isSameDay(nextMsg.createdAt, msg.createdAt));
    listItems.push({ type: 'message', msg, showAvatar, key: msg.id });
  });

  return (
    <KeyboardAvoidingView 
      style={[styles.root, { paddingLeft: insets.left, paddingRight: insets.right }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {!embedded && <StatusBar barStyle="light-content" />}

      {/* Dark gradient background */}
      <LinearGradient colors={['#250b1a', '#10050d']} style={StyleSheet.absoluteFill} />
      
      {/* Background Concentric Rings */}
      <View pointerEvents="none" style={styles.ringsContainer}>
        <View style={[styles.ring, { width: 300, height: 300, borderRadius: 150 }]} />
        <View style={[styles.ring, { width: 500, height: 500, borderRadius: 250 }]} />
        <View style={[styles.ring, { width: 700, height: 700, borderRadius: 350 }]} />
        <View style={[styles.ring, { width: 900, height: 900, borderRadius: 450 }]} />
      </View>

      {/* Header */}
      <View style={[styles.header, isLarge && styles.largeConstrained, { paddingTop: Math.max(insets.top, 20) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Icon name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerProfile} onPress={() => navigation.navigate('ProfileDetail', { profileId: otherProfileId })} activeOpacity={0.8}>
          <View style={styles.avatarWrapper}>
            {displayPhoto ? (
              <AuthImage source={{ uri: displayPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Icon name="person" size={22} color="#FFF" />
              </View>
            )}
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? '#10B981' : '#693655' }]} />
          </View>
          <View style={styles.headerText}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
              {isMuted && <Icon name="notifications-off-outline" size={14} color="#FF5C97" style={{ marginLeft: 5 }} />}
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? '#10B981' : '#693655' }]} />
              <Text style={styles.headerStatus}>{isOnline ? 'Online now' : 'Offline'}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Chat options" style={[styles.headerAction, iBlocked && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 20 }]} onPress={handleMenuPress} activeOpacity={0.8}>
            <Icon name={iBlocked ? 'ban' : 'ellipsis-vertical'} size={22} color={iBlocked ? '#EF4444' : '#FFF'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={() => navigation.navigate('ProfileDetail', { profileId: otherProfileId })} activeOpacity={0.8}>
            <Icon name="information-circle-outline" size={26} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal transparent visible={showMenu} animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={[styles.menuOverlay, { paddingTop: insets.top + 48 }]}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                {!connectionClosed && relationship?.status === 'accepted' && relationship.activeInterest && (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Unconnect" style={styles.menuItem} onPress={() => {
                    setShowMenu(false);
                    Alert.alert('Unconnect?', `Remove your connection with ${displayName}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Unconnect', style: 'destructive', onPress: async () => {
                        try {
                          await cancelInterest(relationship.activeInterest!.id);
                        } catch (error: any) {
                          Alert.alert('Could not unconnect', error?.message ?? 'Please try again.');
                        }
                      } },
                    ]);
                  }}>
                    <Text style={styles.menuItemText}>Unconnect</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.menuItem} onPress={() => { setShowMenu(false); setReportTarget({ profileId: otherProfileId, chatId }); }}>
                  <Text style={styles.menuItemText}>Report conversation</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleMuteToggle}>
                  <Icon name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={isMuted ? '#10B981' : '#F59E0B'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, { color: '#FFF' }]}>
                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }]} onPress={() => { setShowMenu(false); handleBlockToggle(); }}>
                  <Icon name={iBlocked ? 'checkmark-circle-outline' : 'ban-outline'} size={20} color={iBlocked ? '#10B981' : '#EF4444'} style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, { color: iBlocked ? '#10B981' : '#EF4444' }]}>
                    {iBlocked ? `Unblock ${displayName.split(' ')[0]}` : `Block ${displayName.split(' ')[0]}`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }]} onPress={() => { setShowMenu(false); navigation.navigate('ProfileDetail', { profileId: otherProfileId }); }}>
                  <Icon name="person-outline" size={20} color="#FF5C97" style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, { color: '#FFF' }]}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.menuItem, { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' }]} onPress={() => setShowMenu(false)}>
                  <Icon name="close-outline" size={20} color="#94A3B8" style={{ marginRight: 12 }} />
                  <Text style={[styles.menuItemText, { color: '#94A3B8' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <SafetyCenter page={reportTarget ? 'report' : null} target={reportTarget ?? undefined} onClose={() => setReportTarget(null)} />
      
      {iBlocked && (
        <TouchableOpacity style={[styles.blockedBanner, isLarge && styles.largeConstrained]} onPress={handleBlockToggle} activeOpacity={0.85}>
          <Icon name="ban" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.blockedBannerText}>You blocked <Text style={{ fontWeight: '800' }}>{displayName}</Text>. Tap to unblock.</Text>
        </TouchableOpacity>
      )}
      {!iBlocked && blockedByThem && (
        <View style={[styles.blockedByBanner, isLarge && styles.largeConstrained]}>
          <Icon name="shield-outline" size={16} color="#7C3AED" style={{ marginRight: 8 }} />
          <Text style={styles.blockedByBannerText}>You can't reply to this conversation.</Text>
        </View>
      )}
      {!iBlocked && !blockedByThem && !connectionClosed && !isPremium && (
        <TouchableOpacity
          style={[styles.premiumBanner, isLarge && styles.largeConstrained]}
          onPress={() => navigation.navigate('Membership')}
          activeOpacity={0.85}
        >
          <Icon name="diamond" size={15} color="#F59E0B" style={{ marginRight: 8 }} />
          <Text style={styles.premiumBannerText}>
            Chats locked • Free Account. <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>Tap to upgrade</Text> and send messages.
          </Text>
        </TouchableOpacity>
      )}

      {/* Safety & Privacy Notice */}
      <View style={[
        styles.chatSafetyBanner,
        safetyMinimized && styles.chatSafetyBannerMinimized,
        isLarge && styles.largeConstrained,
      ]}>
        <TouchableOpacity
          style={styles.chatSafetyHeaderRow}
          onPress={toggleSafetyNotice}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={safetyMinimized ? 'Expand Safety and Privacy Notice' : 'Minimize Safety and Privacy Notice'}
        >
          <View style={styles.chatSafetyHeaderLeft}>
            <View style={[styles.chatSafetyIconCircle, safetyMinimized && styles.chatSafetyIconCircleSmall]}>
              <ShieldCheck size={safetyMinimized ? 12 : 14} color="#FBBF24" strokeWidth={2.4} />
            </View>
            <Text style={[styles.chatSafetyTitle, safetyMinimized && styles.chatSafetyTitleSmall]}>
              Safety & Privacy Notice
            </Text>
          </View>
          <View style={styles.chatSafetyActionBtn}>
            <Text style={styles.chatSafetyActionBtnText}>{safetyMinimized ? 'View' : 'Minimize'}</Text>
            <Icon name={safetyMinimized ? 'chevron-down' : 'chevron-up'} size={13} color="#FBBF24" />
          </View>
        </TouchableOpacity>
        {!safetyMinimized && (
          <Text style={styles.chatSafetyText}>
            My Dear Partner facilitates matchmaking introductions only. We are not responsible for any personal communications, off-platform meetings, financial transactions, or agreements between members.{' '}
            <Text style={styles.chatSafetyHighlight}>
              Never transfer funds or share banking credentials.
            </Text>
          </Text>
        )}
      </View>

      {/* Messages */}
      <View style={[styles.flex, isLarge && styles.largeConstrained]}>
        {loadingMessages && messages.length === 0 ? (
          <View style={styles.loadingContainer}>
            <BufferingIndicator size="large" color="#FF5C97" />
            <Text style={styles.loadingText}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            refreshing={loadingMessages}
            onRefresh={() => {
              setLoadingMessages(true);
              loadChatMessages(chatId, otherProfileId)
                .then(() => setMessageError(null))
                .catch(error => {
                  if (isRemovedMatch(error)) setMatchRemoved(true);
                  if (isPremium) setMessageError('Could not load messages. Pull down to retry.');
                })
                .finally(() => setLoadingMessages(false));
            }}
            ListHeaderComponent={
              <View>
                {messageError && <Text accessibilityRole="alert" style={styles.historyError}>{messageError}</Text>}
                {history.error && <Text accessibilityRole="alert" style={styles.historyError}>{history.error}</Text>}
                {history.next && <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={history.error ? 'Retry loading more history' : 'Load more history'}
                  accessibilityState={{ disabled: history.loading || loadingMessages, busy: history.loading }}
                  disabled={history.loading || loadingMessages || connectionClosed}
                  style={styles.historyButton}
                  onPress={() => {
                    nearBottomRef.current = false;
                    loadOlderChatMessages(chatId, otherProfileId).catch(error => {
                      if (isRemovedMatch(error)) setMatchRemoved(true);
                    });
                  }}
                ><Text style={styles.historyButtonText}>{history.loading ? 'Loading history…' : history.error ? 'Retry history' : 'Load more history'}</Text></TouchableOpacity>}
              </View>
            }
            ref={listRef}
            data={listItems}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
            onScroll={event => {
              const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
              nearBottomRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
            }}
            scrollEventThrottle={1}
            onContentSizeChange={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
            onLayout={() => { if (nearBottomRef.current) listRef.current?.scrollToEnd({ animated: false }); }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
            ListFooterComponent={
              partnerTyping ? (
                <TypingIndicator
                  visible={partnerTyping}
                  typingUserName={otherProfile?.name?.split(' ')[0]}
                />
              ) : undefined
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIconCircle}>
                  <Icon name="heart" size={32} color="#FF5C97" />
                </View>
                <Text style={styles.emptyTitle}>Say Hello!</Text>
                <Text style={styles.emptyText}>Start a conversation with {otherProfile?.name?.split(' ')[0] ?? 'your match'}</Text>
              </View>
            }
            renderItem={({ item }) => {
              if (item.type === 'separator') {
                return (
                  <View style={styles.daySeparator}>
                    <View style={styles.daySepLine} />
                    <Text style={styles.daySepText}>{item.date}</Text>
                    <View style={styles.daySepLine} />
                  </View>
                );
              }
              const { msg, showAvatar } = item;
              const isMine = msg.senderId === myId || msg.senderId === myMemberId;
              let msgText = msg.text ?? '';
              if (['💬 Message', 'Message', '🔒 Encrypted message'].includes(msgText) || msgText.startsWith('__E2EE__:') || msgText.startsWith('_E2EE_')) {
                msgText = 'Message unavailable';
              }
              const sticker = parseStickerMessage(msgText);

              return (
                <AnimatedMessageRow isMine={isMine}>
                  {!isMine && (
                    <View style={styles.avatarSlot}>
                      {showAvatar && displayPhoto ? (
                        <AuthImage source={{ uri: displayPhoto }} style={styles.bubbleAvatar} />
                      ) : (
                        <View style={styles.bubbleAvatarPlaceholder} />
                      )}
                    </View>
                  )}
                  <View style={[styles.bubbleWrapper, isMine ? styles.bubbleWrapperMine : styles.bubbleWrapperTheirs]}>
                    {!isMine && <TouchableOpacity onPress={() => setReportTarget({ profileId: otherProfileId, chatId, messageId: String(msg.id) })}><Text style={{ color: 'rgba(255, 92, 151, 0.6)', paddingVertical: 8, fontSize: 11 }}>Report message</Text></TouchableOpacity>}
                    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, sticker && styles.stickerBubble]}>
                      {sticker ? (
                        <View style={[styles.stickerMessageCard, { backgroundColor: sticker.surface, borderColor: sticker.accent }]}>
                          <Text style={styles.stickerMessageEmoji}>{sticker.emoji}</Text>
                          <Text style={[styles.stickerMessageLabel, { color: sticker.accent }]}>{sticker.label}</Text>
                        </View>
                      ) : (
                        isMine ? (
                          <LinearGradient colors={['#FF5C97', '#FF2D78']} style={StyleSheet.absoluteFill} />
                        ) : null
                      )}
                      {!sticker && (
                        <Text style={isMine ? styles.textMine : styles.textTheirs}>{msgText}</Text>
                      )}
                      {isMine ? (
                        <View style={[styles.timeRow, { alignItems: 'center' }]}>
                          <Text style={[styles.bubbleTime, sticker && styles.stickerTimeMine]}>{formatBubbleTime(msg.createdAt)}</Text>
                          <AnimatedDeliveryStatusIcon status={msg.deliveryStatus} />
                        </View>
                      ) : (
                        <Text style={[styles.bubbleTime, styles.bubbleTimeTheirs, sticker && styles.stickerTimeTheirs]}>{formatBubbleTime(msg.createdAt)}</Text>
                      )}
                      {isMine && msg.deliveryStatus === 'unconfirmed' && (
                        <Text style={styles.messageStatusHelp}>This message may already be saved. Refresh before sending it again.</Text>
                      )}
                      {isMine && (msg.deliveryStatus === 'failed' || msg.deliveryStatus === 'unconfirmed') && (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={msg.deliveryStatus === 'failed' ? 'Retry message' : 'Refresh message status'}
                          disabled={sending || (msg.deliveryStatus === 'failed' && chatDisabled)}
                          style={styles.messageRetry}
                          onPress={() => {
                            if (msg.deliveryStatus === 'failed') sendContent(msg.text, false, msg.id);
                            else loadChatMessages(chatId, otherProfileId).catch(() => Alert.alert('Unable to refresh', 'Try again when your connection is available.'));
                          }}
                        ><Text style={styles.messageRetryText}>{msg.deliveryStatus === 'failed' ? 'Retry' : 'Refresh conversation'}</Text></TouchableOpacity>
                      )}
                      {isMine && msg.deliveryStatus === 'unconfirmed' && (
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Dismiss local message status" style={styles.messageRetry}
                          onPress={() => Alert.alert('Dismiss local status?', 'First check whether this message appears in the refreshed conversation. Dismissing this status does not delete a message saved by the server.', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Dismiss status', onPress: () => dismissLocalMessage(chatId, msg.id) },
                          ])}>
                          <Text style={styles.messageRetryText}>Dismiss local status</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </AnimatedMessageRow>
              );
            }}
          />
        )}

        {!isPremium ? (
          <View style={[styles.lockedInputBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <View style={[styles.barInner, isLarge && styles.largeConstrained]}>
              <TouchableOpacity
                style={styles.lockedUpgradeCard}
                onPress={() => {
                  triggerHaptic('light');
                  navigation.navigate('Membership');
                }}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Upgrade to Gold to unlock chat"
              >
                <View style={styles.lockedUpgradeInner}>
                  <View style={styles.lockedIconCircle}>
                    <Icon name="lock-closed" size={18} color="#FFFFFF" />
                  </View>

                  <View style={styles.lockedTextWrap}>
                    <View style={styles.lockedHeaderRow}>
                      <Text style={styles.lockedTitle}>Chats locked</Text>
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>FREE ACCOUNT</Text>
                      </View>
                    </View>
                    <Text style={styles.lockedSubtitle} numberOfLines={2}>
                      Upgrade to Gold or Elite to chat with {displayName.split(' ')[0]}.
                    </Text>
                  </View>

                  <View style={styles.lockedCtaPill}>
                    <Text style={styles.lockedCtaText}>Upgrade</Text>
                    <Icon name="chevron-forward" size={13} color="#FFF" />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        ) : chatDisabled ? (
          <View style={[styles.blockedInputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={[styles.barInnerRow, isLarge && styles.largeConstrained]}>
              <Icon name="lock-closed-outline" size={18} color="#FF5C97" style={{ marginRight: 8 }} />
              <Text style={styles.blockedInputText}>
                {connectionClosed ? 'This connection has ended. Messaging is unavailable.' : iBlocked ? `You blocked ${displayName}. Unblock to send messages.` : 'You cannot send messages in this conversation.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) }]}>
            <View style={[styles.barInner, isLarge && styles.largeConstrained]}>
              {!text.trim() && (
                <QuickReplyBar
                  onSelectPrompt={prompt => {
                    setText(prompt);
                  }}
                  partnerName={otherProfile?.name}
                  isNewConversation={messages.length <= 4}
                />
              )}
              <View style={styles.inputRow}>
                <TouchableOpacity style={styles.emojiBtn} onPress={() => toggleComposerPanel('emoji')}>
                  <Icon name={composerPanel === 'emoji' ? 'keyboard-outline' : 'happy-outline'} size={24} color={composerPanel === 'emoji' ? '#FF5C97' : '#94A3B8'} />
                </TouchableOpacity>
                <TextInput
                  style={styles.input}
                  accessibilityLabel="Message"
                  placeholder="Type a message..."
                  placeholderTextColor="#94A3B8"
                  value={text}
                  onChangeText={handleTextChange}
                  onFocus={() => setComposerPanel(null)}
                  multiline
                  maxLength={500}
                  keyboardAppearance="dark"
                />
                <AnimatedButton
                  accessibilityRole="button"
                  accessibilityLabel="Send message"
                  activeScale={0.88}
                  style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
                  onPress={onSend}
                  disabled={!text.trim() || sending}
                >
                  <LinearGradient colors={text.trim() ? ['#FF5C97', '#FF2D78'] : ['#351829', '#351829']} style={styles.sendBtnGradient}>
                    <Icon name="send" size={18} color={text.trim() ? '#FFF' : '#64748B'} />
                  </LinearGradient>
                </AnimatedButton>
              </View>
            </View>
          </View>
        )}
        
        {composerPanel === 'emoji' && (
          <View style={[styles.composerDrawer, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: Math.min(310, height * 0.45) }]}>
            <View style={[styles.barInner, isLarge && styles.largeConstrained]}>
              <View style={styles.drawerHeader}>
                <Text style={styles.drawerTitle}>Emojis</Text>
                <TouchableOpacity onPress={() => setComposerPanel(null)} style={styles.drawerCloseBtn}>
                  <Icon name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCategoryTabs}>
                {EMOJI_CATEGORIES.map(category => (
                  <TouchableOpacity key={category.id} style={[styles.emojiCategoryTab, category.id === emojiCategoryId && styles.emojiCategoryTabSelected]} onPress={() => setEmojiCategoryId(category.id)}>
                    <Text style={[styles.emojiCategoryTabText, category.id === emojiCategoryId && { color: '#FF2D78' }]}>{category.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.emojiGrid}>
                {(EMOJI_CATEGORIES.find(c => c.id === emojiCategoryId) ?? EMOJI_CATEGORIES[0]).emojis.map(emoji => (
                  <TouchableOpacity key={emoji} style={styles.emojiItem} onPress={() => appendEmoji(emoji)}>
                    <Text style={styles.emojiChar}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  historyButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', padding: 12 },
  historyButtonText: { color: '#FF8BB7', fontWeight: '700' },
  historyError: { color: '#FCA5A5', padding: 16 },
  root: { flex: 1, backgroundColor: '#10050d' },
  flex: { flex: 1 },
  deliveryText: { marginLeft: 6, flexShrink: 1 },
  messageStatusHelp: { color: '#FFF', fontSize: 12, lineHeight: 18, marginTop: 8 },
  messageRetry: { minHeight: 44, justifyContent: 'center', paddingVertical: 8 },
  messageRetryText: { color: '#FFF', fontWeight: '700', textDecorationLine: 'underline' },
  largeConstrained: { maxWidth: 680, width: '100%', alignSelf: 'center' },
  barInner: { width: '100%' },
  barInnerRow: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  ringsContainer: {
    ...(StyleSheet.absoluteFill as any),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
    opacity: 0.15,
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FF5C97',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerProfile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrapper: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#FF5C97' },
  avatarPlaceholder: { backgroundColor: '#351829', alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#10050d' },
  headerText: { flex: 1 },
  headerName: { fontSize: 17, fontWeight: '800', color: '#FFF', letterSpacing: -0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  headerStatus: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  headerAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20 },
  
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'flex-end', paddingRight: 16 },
  menuCard: { backgroundColor: '#250b1a', borderRadius: 24, minWidth: 220, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255, 92, 151, 0.3)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  menuItemText: { fontSize: 15, fontWeight: '600', color: '#FFF' },

  blockedBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 16, paddingVertical: 10 },
  blockedBannerText: { fontSize: 13, color: '#EF4444', fontWeight: '600', flex: 1 },
  blockedByBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124, 58, 237, 0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(124, 58, 237, 0.2)', paddingHorizontal: 16, paddingVertical: 10 },
  blockedByBannerText: { fontSize: 13, color: '#A78BFA', fontWeight: '600', flex: 1 },

  listContent: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  daySeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 10 },
  daySepLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  daySepText: { fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: '600', letterSpacing: 0.5 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: 'rgba(255,255,255,0.7)' },
  
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyIconCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 92, 151, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', marginBottom: 8 },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },

  messageRow: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 32, marginRight: 8, alignItems: 'center', justifyContent: 'flex-end' },
  bubbleAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  bubbleAvatarPlaceholder: { width: 30 },
  bubbleWrapper: { maxWidth: '75%' },
  bubbleWrapperMine: { alignItems: 'flex-end' },
  bubbleWrapperTheirs: { alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, overflow: 'hidden' },
  bubbleMine: { borderRadius: 20, borderBottomRightRadius: 5 },
  bubbleTheirs: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, borderBottomLeftRadius: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  textMine: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, fontWeight: '500', position: 'relative', zIndex: 1 },
  textTheirs: { color: '#FFFFFF', fontSize: 15, lineHeight: 22, fontWeight: '500' },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500', textAlign: 'right', marginTop: 4, position: 'relative', zIndex: 1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 2, position: 'relative', zIndex: 1 },
  bubbleTimeTheirs: { color: 'rgba(255,255,255,0.5)', textAlign: 'left' },
  
  stickerBubble: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 5, backgroundColor: 'transparent' },
  stickerMessageCard: { minWidth: 118, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' },
  stickerMessageEmoji: { fontSize: 42, lineHeight: 50 },
  stickerMessageLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  stickerTimeMine: { color: 'rgba(255,255,255,0.8)' },
  stickerTimeTheirs: { color: 'rgba(255,255,255,0.5)' },

  inputBar: { paddingHorizontal: 14, paddingTop: 10, backgroundColor: '#10050d', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  blockedInputBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#250b1a', paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  blockedInputText: { color: '#FFF', fontSize: 13, flex: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  emojiBtn: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 100, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#FFF', fontWeight: '500', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden' },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnGradient: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },

  composerDrawer: { backgroundColor: '#10050d', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingTop: 10, maxHeight: 310 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  drawerTitle: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  drawerCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  emojiCategoryTabs: { gap: 8, paddingBottom: 10 },
  emojiCategoryTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  emojiCategoryTabSelected: { backgroundColor: 'rgba(255, 92, 151, 0.15)' },
  emojiCategoryTabText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  emojiItem: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  emojiChar: { fontSize: 24 },

  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  premiumBannerText: {
    fontSize: 13,
    color: '#FBBF24',
    fontWeight: '600',
    flex: 1,
  },
  premiumHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  premiumHintText: {
    color: '#FBBF24',
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  icebreakersWrapper: {
    marginBottom: 8,
    paddingTop: 4,
  },
  icebreakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  icebreakerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF5C97',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  icebreakerScroll: {
    gap: 8,
    paddingHorizontal: 4,
  },
  icebreakerChip: {
    backgroundColor: '#261320',
    borderColor: '#4A1D36',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  icebreakerChipText: {
    fontSize: 12,
    color: '#FCE7F3',
    fontWeight: '500',
  },
  lockedInputBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#10050d',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  lockedUpgradeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#D97706',
    backgroundColor: '#260D1E',
  },
  lockedUpgradeInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  lockedIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lockedTextWrap: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },
  lockedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
    marginRight: 6,
  },
  lockedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  lockedBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.6,
  },
  lockedSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    lineHeight: 15,
  },
  lockedCtaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF2A7A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  lockedCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFF',
    marginRight: 2,
  },
  chatSafetyBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.22)',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 6,
    padding: 10,
  },
  chatSafetyBannerMinimized: {
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  chatSafetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  chatSafetyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  chatSafetyIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  chatSafetyIconCircleSmall: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  chatSafetyTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 0.2,
  },
  chatSafetyTitleSmall: {
    fontSize: 11,
    fontWeight: '700',
  },
  chatSafetyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.14)',
  },
  chatSafetyActionBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FBBF24',
  },
  chatSafetyText: {
    fontSize: 10.5,
    lineHeight: 15,
    color: 'rgba(255, 255, 255, 0.82)',
    marginTop: 6,
  },
  chatSafetyHighlight: {
    fontWeight: '700',
    color: '#FDE68A',
  },
});
