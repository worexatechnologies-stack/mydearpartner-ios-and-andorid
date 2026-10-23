import ChatScreen from '../ChatScreen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';
import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect, useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { ShieldCheck } from 'lucide-react-native';
import AnimatedButton from '../../components/AnimatedButton';
import AuthImage from '../../components/AuthImage';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import PageHeading from '../../components/PageHeading';
import ScreenContainer from '../../components/ScreenContainer';
import MotionView from '../../components/MotionView';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import {
  colors,
  fontSizes,
  radii,
  shadow,
  spacing,
  typeScale,
} from '../../theme/theme';
import { getChatContentPreview } from '../../utils/chatContent';
import { triggerHaptic } from '../../utils/haptics';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Chats'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function ChatsListScreen(props: Props) {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const focused = useIsFocused();
  const [selected, setSelected] = useState<RootStackParamList['Chat'] | null>(null);
  const wide = width - insets.left - insets.right >= (fontScale > 1.5 ? 1100 : 900);
  const closeConversation = useCallback(() => setSelected(null), []);
  const chatNavigation = useMemo(() => ({ ...props.navigation, goBack: closeConversation }), [props.navigation, closeConversation]);
  return <View style={styles.workspace}>
    {(wide || !selected) && <View style={wide ? styles.sidebar : styles.workspacePane}>
      <ConversationList {...props} onOpenChat={wide ? setSelected : undefined} selectedId={selected?.chatId} />
    </View>}
    {(wide || selected) && <View style={[styles.workspacePane, { paddingBottom: tabBarHeight + Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) + 8 }]}>
      {selected && focused ? <ChatScreen
        key={selected.chatId}
        embedded
        route={{ key: `tablet-chat-${selected.chatId}`, name: 'Chat', params: selected }}
        navigation={chatNavigation as any}
      /> : <View style={styles.workspaceEmpty}><Text style={styles.workspaceTitle}>Your conversations</Text><Text style={styles.workspaceHint}>Select a conversation to read and reply.</Text></View>}
    </View>}
  </View>;
}

function ConversationList({ navigation, onOpenChat, selectedId }: Props & {
  onOpenChat?: (params: RootStackParamList['Chat']) => void;
  selectedId?: string;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { currentUser } = useAuth();
  const {
    chats,
    getProfileById,
    getOtherParticipantId,
    sentInterests,
    receivedInterests,
    refreshChats,
    chatsError,
    isLoadingProfiles,
    isUserMuted,
    isBlockedByMe,
  } = useAppData();
  const { isPremium } = usePlanAllowance();
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshChats();
    } finally {
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshChats().catch(() => {});
    }, [refreshChats]),
  );

  React.useEffect(() => {
    const { DeviceEventEmitter } = require('react-native');
    const sub = DeviceEventEmitter.addListener('REFRESH_CHATS', () => {
      refreshChats().catch(() => {});
    });
    return () => sub.remove();
  }, [refreshChats]);

  const sortedChats = [...chats].sort(
    (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
  );

  const searchTerm = searchQuery.trim().toLocaleLowerCase();
  // Ensure uniqueness to prevent React key duplication errors
  const uniqueByKey = <T extends any>(arr: T[], key = 'id'): T[] => {
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item[key as keyof T])) return false;
      seen.add(item[key as keyof T]);
      return true;
    });
  };

  const visibleChats = uniqueByKey(
    sortedChats.filter(chat => {
      const otherId = getOtherParticipantId(chat);
      const profile = getProfileById(otherId) || chat.otherProfile;
      if (!profile || isBlockedByMe(profile.id)) return false;

      if (searchTerm) {
        const name = profile.name ?? '';
        const preview = getChatContentPreview(chat.lastMessage);
        return `${name} ${preview}`.toLocaleLowerCase().includes(searchTerm);
      }
      return true;
    }),
  );

  const chatPartnerIds = new Set(
    chats.map(c => c.otherProfile?.id).filter(Boolean),
  );
  const newMatches = uniqueByKey(
    ([...sentInterests, ...receivedInterests] as any[])
      .filter(i => i.status === 'accepted')
      .map(i => {
        const receiver =
          i.receiverProfile ||
          getProfileById(i.receiverProfile?.id ?? i.toUserId);
        const sender =
          i.senderProfile ||
          getProfileById(i.senderProfile?.id ?? i.fromUserId);

        const myProfileId = currentUser?.profile?.id;
        if (receiver && receiver.id !== myProfileId) return receiver;
        if (sender && sender.id !== myProfileId) return sender;
        return null;
      })
      .filter((p): p is NonNullable<typeof p> =>
        Boolean(p && p.id && !chatPartnerIds.has(p.id)),
      ),
  ).slice(0, 6);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <ScreenContainer style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <PageHeading
          eyebrow="KEEP THE CONVERSATION GOING"
          title="Your conversations"
        />
        <AnimatedButton
          style={styles.searchBtn}
          accessibilityLabel={
            searchOpen ? 'Close message search' : 'Search messages'
          }
          onPress={() => {
            triggerHaptic('light');
            setSearchOpen(open => !open);
            if (searchOpen) setSearchQuery('');
          }}
        >
          <Icon
            name={searchOpen ? 'close-outline' : 'search-outline'}
            size={21}
            color={colors.text}
          />
        </AnimatedButton>
      </View>

      {searchOpen && (
        <View style={styles.searchWrap}>
          <Icon name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations"
            placeholderTextColor={colors.textTertiary}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            style={styles.searchInput}
            accessibilityLabel="Search conversations"
          />
          {searchQuery.length > 0 && (
            <AnimatedButton
              style={styles.clearSearchBtn}
              onPress={() => setSearchQuery('')}
              accessibilityLabel="Clear message search"
            >
              <Icon name="close-circle" size={18} color={colors.textTertiary} />
            </AnimatedButton>
          )}
        </View>
      )}

      {/* Premium Expired / Required Notice */}
      {!isPremium && (
        <AnimatedButton
          style={styles.premiumBannerCard}
          onPress={() => {
            triggerHaptic('light');
            navigation.navigate('Membership');
          }}
          accessibilityLabel="Upgrade to Premium Membership"
        >
          <LinearGradient
            colors={['#2A1024', '#170614']}
            style={styles.premiumBannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Ambient luxury light sheen */}
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.16)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 0.6 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.premiumBannerIconCircle}>
              <LinearGradient
                colors={['#FBBF24', '#D97706']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Icon name="diamond" size={18} color="#FFFFFF" />
            </View>

            <View style={styles.premiumBannerTextWrap}>
              <View style={styles.premiumBadgeRow}>
                <Icon name="lock-closed" size={10} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.premiumBadgeText}>CHATS LOCKED • FREE PLAN</Text>
              </View>
              <Text style={styles.premiumBannerHeading}>Unlock Unlimited Chats</Text>
              <Text style={styles.premiumBannerSubheading} numberOfLines={2}>
                Upgrade to Gold or Platinum to message and connect with matches.
              </Text>
            </View>

            <View style={styles.premiumBannerButton}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.premiumBannerBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.premiumBannerButtonText}>Upgrade</Text>
                <Icon name="chevron-forward" size={13} color="#FFFFFF" />
              </LinearGradient>
            </View>
          </LinearGradient>
        </AnimatedButton>
      )}

      {/* New matches story row */}
      {newMatches.length > 0 && (
        <View style={styles.matchesSection}>
          <Text style={styles.sectionLabel}>NEW MATCHES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={1}
            style={styles.matchScroll}
          >
            {newMatches.map(profile => (
              <AnimatedButton
                key={profile.id}
                style={styles.matchItem}
                onPress={() => {
                  triggerHaptic('light');
                  navigation.navigate('ProfileDetail', {
                    profileId: profile.id,
                  });
                }}
              >
                <View style={styles.matchAvatarWrapper}>
                  <AuthImage
                    source={{ uri: profile.photo }}
                    style={styles.matchAvatar}
                  />
                  {profile.isOnline && <View style={styles.matchOnlineDot} />}
                </View>
                <Text style={styles.matchName} numberOfLines={1}>
                  {profile.name.split(' ')[0]}
                </Text>
              </AnimatedButton>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Safety & Privacy Notice */}
      <View style={styles.safetyNoticeCard}>
        <View style={styles.safetyHeaderRow}>
          <View style={styles.safetyIconBadge}>
            <ShieldCheck size={16} color="#B45309" strokeWidth={2.4} />
          </View>
          <Text style={styles.safetyTitle}>Safety & Privacy Notice</Text>
        </View>
        <Text style={styles.safetyDescription}>
          My Dear Partner facilitates matchmaking introductions only. We are not responsible for any personal communications, off-platform meetings, financial transactions, or agreements between members.{' '}
          <Text style={styles.safetyHighlight}>
            Never transfer funds or share banking credentials.
          </Text>
        </Text>
      </View>

      {/* Chat list */}
      <Text
        style={[
          styles.sectionLabel,
          { marginBottom: 8, marginHorizontal: spacing.lg },
        ]}
      >
        ALL CONVERSATIONS
      </Text>
      <FlatList
        data={visibleChats}
        keyExtractor={item => item.id}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              tabBarHeight +
              Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) +
              16,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        initialNumToRender={8}
        windowSize={7}
        scrollEventThrottle={1}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          chatsError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Unable to refresh"
              description={chatsError}
              buttonText="Try again"
              onButtonPress={handleRefresh}
            />
          ) : undefined
        }
        ListEmptyComponent={
          isLoadingProfiles ? (
            <LoadingState label="Loading conversations…" />
          ) : searchTerm ? (
            <EmptyState
              icon="search-outline"
              title="No conversations found"
              description="Try a different name or message."
            />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title="No messages yet"
              description="When you start chatting, your conversations will appear here."
            />
          )
        }
        renderItem={({ item, index }) => {
          const otherId = getOtherParticipantId(item);
          // If the profile is in the app-wide cache (which has correctly formatted photos from /profiles/), use it.
          // Otherwise, fallback to the profile object provided by the /conversations/ API.
          const profile = getProfileById(otherId) || item.otherProfile;

          if (!profile) return null;
          const isMuted =
            isUserMuted(profile.id) ||
            isUserMuted(item.id) ||
            (otherId ? isUserMuted(otherId) : false);
          const hasUnread = (item.unreadCount ?? 0) > 0;
          const preview = (() => {
            if (item.connectionClosed) return 'Connection ended';
            const rawPreview = getChatContentPreview(item.lastMessage);
            if (!rawPreview) return 'Say hello';
            if (
              rawPreview.startsWith('__E2EE__:') ||
              rawPreview.startsWith('_E2EE_') ||
              rawPreview === '🔒 Encrypted message' ||
              rawPreview === 'Message' ||
              rawPreview === '💬 Message' ||
              rawPreview.trim() === '💬 Message' ||
              rawPreview.trim() === 'Message' ||
              rawPreview === 'Loading...' ||
              (rawPreview.toLowerCase().includes('message') &&
                (rawPreview.includes('💬') || rawPreview.includes('🔒')))
            ) {
              return 'Loading...';
            }
            return rawPreview;
          })();

          return (
            <MotionView index={index} style={{ width: '100%' }}>
              <ChatRow
                item={item}
                profile={profile}
                otherId={otherId!}
                hasUnread={hasUnread}
                isMuted={isMuted}
                preview={preview}
                selected={selectedId === item.id}
                formatTime={formatTime}
                onPress={() => {
                if (!isPremium) {
                  Alert.alert(
                    'Premium Required',
                    'Chatting is reserved for Premium members. Upgrade to Gold or Elite to read and send messages.',
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
                const params = { chatId: item.id, otherProfileId: profile.id,
                  fallbackName: profile.name, fallbackPhoto: profile.photo };
                if (onOpenChat) onOpenChat(params);
                else navigation.navigate('Chat', params);
              }}
            />
            </MotionView>
          );
        }}
      />
    </ScreenContainer>
  );
}

import { subscribeToPresence } from '../../services/PresenceService';

function ChatRow({
  item,
  profile,
  hasUnread,
  isMuted,
  preview,
  formatTime,
  onPress,
  selected,
}: any) {
  const [isOnline, setIsOnline] = useState(profile.isOnline === true);

  React.useEffect(() => {
    const memberId = profile.userId || profile.id;
    if (memberId) return subscribeToPresence(memberId, setIsOnline);
  }, [profile.userId, profile.id]);

  return (
    <AnimatedButton
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityLabel={`${profile.name}${
        hasUnread ? `, ${item.unreadCount ?? 0} unread messages` : ''
      }`}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        <AuthImage source={{ uri: profile.photo }} style={styles.avatar} />
        {isOnline && <View style={styles.onlineDot} />}
      </View>

      {/* Content */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flex: 1,
              marginRight: 8,
            }}
          >
            <Text
              style={[styles.name, hasUnread && styles.nameUnread]}
              numberOfLines={1}
            >
              {profile.name}
            </Text>
            {isMuted && (
              <Icon
                name="notifications-off-outline"
                size={13}
                color={colors.textTertiary}
                style={{ marginLeft: 5 }}
              />
            )}
          </View>
          {item.lastMessageAt ? (
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          ) : null}
        </View>
        <Text
          style={[styles.preview, hasUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      {/* Arrow or Animated Unread Badge */}
      {hasUnread ? (
        <Animated.View style={styles.unreadBadge}>
          <Text style={styles.unreadBadgeText}>
            {(item.unreadCount ?? 0) > 10
              ? '10+'
              : String(item.unreadCount ?? 0)}
          </Text>
        </Animated.View>
      ) : (
        <Text style={styles.rowArrow}>›</Text>
      )}
    </AnimatedButton>
  );
}

const styles = StyleSheet.create({
  workspace: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  workspacePane: { flex: 1, minWidth: 0 },
  sidebar: { width: 320, borderRightWidth: 1, borderRightColor: colors.border },
  workspaceEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  workspaceTitle: { fontSize: 22, fontWeight: '700', color: colors.text, textAlign: 'center' },
  workspaceHint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  rowSelected: { backgroundColor: colors.surfaceTint, borderColor: colors.primary },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    ...typeScale.display,
    fontSize: 32,
    color: colors.primaryDark,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background, // Match iOS grey search button
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    marginLeft: 8,
    color: colors.text,
    fontSize: fontSizes.md,
  },
  clearSearchBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchesSection: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 1,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  matchScroll: {
    paddingLeft: spacing.lg,
  },
  matchItem: {
    alignItems: 'center',
    marginRight: 16,
    width: 64,
  },
  matchAvatarWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    position: 'relative',
    marginBottom: 6,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  matchAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
  },
  matchOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  matchName: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.divider,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  name: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  nameUnread: {
    fontWeight: '800',
  },
  time: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '700',
  },
  preview: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    fontWeight: '400',
    marginTop: 2,
  },
  previewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  rowArrow: {
    fontSize: 20,
    color: colors.border,
    marginLeft: 8,
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    marginLeft: 8,
  },
  unreadBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  premiumBannerCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    ...shadow.card,
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  premiumBannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.sm,
  },
  premiumBannerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  premiumBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  premiumBadgeText: {
    color: '#FBBF24',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  premiumBannerHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  premiumBannerSubheading: {
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.72)',
    lineHeight: 15.5,
    fontWeight: '500',
  },
  premiumBannerButton: {
    borderRadius: 20,
    overflow: 'hidden',
    flexShrink: 0,
    ...shadow.sm,
  },
  premiumBannerBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 3,
  },
  premiumBannerButtonText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  safetyNoticeCard: {
    backgroundColor: '#FFFBEB',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: spacing.md,
    ...shadow.sm,
  },
  safetyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  safetyIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  safetyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  safetyDescription: {
    fontSize: 12,
    lineHeight: 17,
    color: '#78350F',
    fontWeight: '400',
  },
  safetyHighlight: {
    fontWeight: '700',
    color: '#92400E',
  },
});
