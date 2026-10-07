function isRemovedMatch(error: unknown): boolean {
  const value = error as { code?: string; message?: string } | null;
  return value?.code === 'match_removed' || value?.message === 'This match has been removed.';
}

import BufferingIndicator from '../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React,{ useEffect,useLayoutEffect,useRef,useState } from 'react';
import {

Alert,
AppState,
DeviceEventEmitter,
FlatList,
Keyboard,
KeyboardAvoidingView,
Modal,
Platform,
ScrollView,
StatusBar,
StyleSheet,
Text,
TextInput,
TouchableOpacity,
TouchableWithoutFeedback,
View,
useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { blockService } from '../api/blockService';
import { ReportTarget } from '../api/safetyService';
import { chatWsClient } from '../api/wsClient';
import AuthImage from '../components/AuthImage';
import SafetyCenter from '../components/SafetyCenter';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { subscribeToPresence } from '../services/PresenceService';
import { Message } from '../types/models';
import { parseStickerMessage } from '../utils/chatContent';
import { triggerHaptic } from '../utils/haptics';

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
      '✨',
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
      '✨',
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

export default function ChatScreen({ route, navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const isLarge = width >= 640;
  const { chatId, otherProfileId, fallbackName, fallbackPhoto } = route.params;
  const {
    chats,
    getProfileById,
    getMessagesForChat,
    sendMessage,
    loadChatMessages,
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
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [composerPanel, setComposerPanel] = useState<ComposerPanel>(null);
  const [emojiCategoryId, setEmojiCategoryId] = useState<EmojiCategoryId>(
    EMOJI_CATEGORIES[0].id,
  );
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [blockedByThem, setBlockedByThem] = useState(false);
  const [matchRemoved, setMatchRemoved] = useState(false);
  const listRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const otherProfile = getProfileById(otherProfileId);
  const messages = getMessagesForChat(chatId);
  const [loadingMessages, setLoadingMessages] = useState(messages.length === 0);
  const [messageError, setMessageError] = useState<string | null>(null);

  // Auto-scroll to latest message when messages change or load
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Is this person blocked by ME?
  const iBlocked = isBlockedByMe(otherProfileId);
  // Is this person/conversation muted?
  const isMuted = isUserMuted(otherProfileId) || isUserMuted(chatId);
  // Either side blocked = disable chat
  const connectionClosed = matchRemoved || !!chats?.find(chat => String(chat.id) === String(chatId))?.connectionClosed;
  const chatDisabled = iBlocked || blockedByThem || connectionClosed;
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

  // Check if they have blocked me
  useEffect(() => {
    let cancelled = false;
    blockService.checkIfBlockedBy(otherProfileId).then(result => {
      if (!cancelled) setBlockedByThem(result);
    }).catch(() => {
      // The server still authorizes every send; avoid an unhandled rejection.
    });
    return () => {
      cancelled = true;
    };
  }, [otherProfileId]);

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
        if (isMounted) setMessageError('Could not load messages. Pull down to retry.');
      } finally {
        if (isMounted) setLoadingMessages(false);
      }
    };
    const connect = () => {
      if (connectionClosed) return;
      connectToChat(chatId, otherProfileId, setPartnerTyping);
      refresh();
    };
    setLoadingMessages(true);
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
  }, [chatId, otherProfileId, loadChatMessages, connectToChat, disconnectFromChat, connectionClosed]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const stopTyping = () => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    chatWsClient.sendTyping(false);
  };

  const signalTyping = () => {
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

  const sendContent = async (content: string, restoreTextOnFailure = false) => {
    const toSend = content.trim();
    if (!toSend || sending || chatDisabled) return;

    stopTyping();
    triggerHaptic(parseStickerMessage(toSend) ? 'medium' : 'light');
    if (restoreTextOnFailure) setText('');
    setSending(true);
    setComposerPanel(null);
    try {
      await sendMessage(chatId, toSend, otherProfileId);
    } catch (err: any) {
      if (restoreTextOnFailure) setText(toSend);
      // Plan and permission denials also use 403. Only disable the chat when
      // the block endpoint confirms that the partner actually blocked us.
      if (isRemovedMatch(err)) setMatchRemoved(true);
      else if (err?.status === 403) {
        const confirmedBlocked = await blockService.checkIfBlockedBy(otherProfileId).catch(() => false);
        if (confirmedBlocked) setBlockedByThem(true);
      }
      Alert.alert(
        restoreTextOnFailure ? 'Couldn’t send message' : 'Couldn’t send sticker',
        err?.message || 'Please check your connection and try again.',
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
    >
      <StatusBar barStyle="light-content" />

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
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) }]}>
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
          <TouchableOpacity style={[styles.headerAction, iBlocked && { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderRadius: 20 }]} onPress={handleMenuPress} activeOpacity={0.8}>
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
        <TouchableOpacity style={styles.blockedBanner} onPress={handleBlockToggle} activeOpacity={0.85}>
          <Icon name="ban" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.blockedBannerText}>You blocked <Text style={{ fontWeight: '800' }}>{displayName}</Text>. Tap to unblock.</Text>
        </TouchableOpacity>
      )}
      {!iBlocked && blockedByThem && (
        <View style={styles.blockedByBanner}>
          <Icon name="shield-outline" size={16} color="#7C3AED" style={{ marginRight: 8 }} />
          <Text style={styles.blockedByBannerText}>You can't reply to this conversation.</Text>
        </View>
      )}

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
                .catch(() => setMessageError('Could not load messages. Pull down to retry.'))
                .finally(() => setLoadingMessages(false));
            }}
            ListHeaderComponent={messageError ? <Text accessibilityRole="alert" style={{ color: '#EF4444', padding: 16 }}>{messageError}</Text> : undefined}
            ref={listRef}
            data={listItems}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
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
                <View style={[styles.messageRow, isMine ? styles.rowMine : styles.rowTheirs]}>
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
                        <View style={styles.timeRow}>
                          <Text style={[styles.bubbleTime, sticker && styles.stickerTimeMine]}>{formatBubbleTime(msg.createdAt)}</Text>
                          <Icon name="checkmark-done" size={14} color="#FFF" style={{ marginLeft: 4 }} />
                        </View>
                      ) : (
                        <Text style={[styles.bubbleTime, styles.bubbleTimeTheirs, sticker && styles.stickerTimeTheirs]}>{formatBubbleTime(msg.createdAt)}</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
            ListFooterComponent={
              partnerTyping ? (
                <View style={[styles.messageRow, styles.rowTheirs, { marginTop: 4, marginBottom: 8 }]}>
                  <View style={styles.avatarSlot} />
                  <View style={[styles.bubble, styles.bubbleTheirs, { paddingVertical: 10, paddingHorizontal: 16 }]}>
                    <Text style={[styles.textTheirs, { fontStyle: 'italic', opacity: 0.6 }]}>typing...</Text>
                  </View>
                </View>
              ) : undefined
            }
          />
        )}

        {chatDisabled ? (
          <View style={[styles.blockedInputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Icon name="lock-closed-outline" size={18} color="#FF5C97" style={{ marginRight: 8 }} />
            <Text style={styles.blockedInputText}>
              {connectionClosed ? 'This connection has ended. Messaging is unavailable.' : iBlocked ? `You blocked ${displayName}. Unblock to send messages.` : 'You cannot send messages in this conversation.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 8) }]}>
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
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Send message" style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={onSend} disabled={!text.trim() || sending} activeOpacity={0.8}>
                <LinearGradient colors={text.trim() ? ['#FF5C97', '#FF2D78'] : ['#351829', '#351829']} style={styles.sendBtnGradient}>
                  <Icon name="send" size={18} color={text.trim() ? '#FFF' : '#64748B'} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}
        
        {composerPanel === 'emoji' && (
          <View style={[styles.composerDrawer, { paddingBottom: Math.max(insets.bottom, 12), maxHeight: Math.min(310, height * 0.45) }]}>
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
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#10050d' },
  flex: { flex: 1 },
  largeConstrained: { maxWidth: 680, width: '100%', alignSelf: 'center' },
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
});
