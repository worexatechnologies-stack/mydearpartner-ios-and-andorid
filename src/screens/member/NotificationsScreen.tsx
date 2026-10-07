import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import {
  navigateToChat,
  navigateToInterests,
} from '../../navigation/navigationRef';
import { RootStackParamList } from '../../navigation/types';
import {
  colors,
  fontSizes,
  radii,
  shadow,
  spacing,
  typeScale,
} from '../../theme/theme';
import { formatRelativeTime } from '../../utils/relativeTime';
import { getItem, setItem } from '../../utils/storage';

const READ_NOTIFS_KEY = '@mdp/read_notification_ids';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
  type: 'message' | 'like' | 'match' | 'system';
  chatId?: string;
  otherProfileId?: string;
  fallbackName?: string;
  fallbackPhoto?: string;
}

export default function NotificationsScreen({ navigation }: Props) {
  const {
    receivedInterests,
    chats,
    getProfileById,
    clearedNotificationIds,
    clearNotifications,
  } = useAppData();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // Load persisted read notification IDs on mount
  useEffect(() => {
    getItem<string[]>(READ_NOTIFS_KEY).then(saved => {
      if (saved && Array.isArray(saved)) {
        setReadIds(new Set(saved));
      }
    });
  }, []);

  const markIdsAsRead = useCallback((ids: string[]) => {
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      setItem(READ_NOTIFS_KEY, Array.from(next));
      return next;
    });
  }, []);

  // Generate dynamic notifications from real chats and interests
  const notifications = useMemo(() => {
    const list: NotificationItem[] = [];

    // 1. Chat & Message notifications
    chats.forEach(chat => {
      const partner = chat.otherProfile;
      if (!partner) return;
      if (!chat.lastMessage && !chat.lastMessageAt) return;

      const notifId = `chat-${chat.id}-${chat.lastMessageAt || 'init'}`;
      const unread = (chat.unreadCount ?? 0) > 0;
      const isMarkedRead = readIds.has(notifId);

      let bodyText = chat.lastMessage || '';
      if (
        bodyText === '💬 Message' ||
        bodyText === 'Message' ||
        bodyText === '🔒 Encrypted message' ||
        bodyText.startsWith('__E2EE__:') ||
        bodyText.startsWith('_E2EE_')
      ) {
        bodyText = 'Loading...';
      } else if (!bodyText) {
        bodyText = 'Conversation started. Tap to open chat!';
      }

      list.push({
        id: notifId,
        title: unread ? `New message from ${partner.name}` : partner.name,
        body: bodyText,
        time: formatRelativeTime(chat.lastMessageAt),
        read: !unread || isMarkedRead,
        type: 'message',
        chatId: chat.id,
        otherProfileId: partner.id,
        fallbackName: partner.name,
        fallbackPhoto: partner.photo,
      });
    });

    // 2. Received interests notifications
    receivedInterests.forEach(interest => {
      const profile =
        interest.senderProfile || getProfileById(interest.fromUserId);
      if (!profile) return;

      const notifId = `like-${interest.id}`;
      const isPending = interest.status === 'pending';
      const isMarkedRead = readIds.has(notifId);

      list.push({
        id: notifId,
        title: isPending ? 'New Interest Received!' : 'Interest Received',
        body: `${profile.name} liked your profile. Tap to view!`,
        time: formatRelativeTime(interest.createdAt),
        read: !isPending || isMarkedRead,
        type: 'like',
        otherProfileId: profile.id,
        fallbackName: profile.name,
        fallbackPhoto: profile.photo,
      });
    });

    // 3. Fallback welcome notification only if genuinely no notifications and not cleared
    if (list.length === 0 && !clearedNotificationIds.includes('sys-welcome')) {
      list.push({
        id: 'sys-welcome',
        title: 'Welcome to MyDearPartner!',
        body: 'Complete verification to help other members get to know you.',
        time: 'Just now',
        read: true,
        type: 'system',
      });
    }

    // Filter out cleared notifications
    return list.filter(n => !clearedNotificationIds.includes(n.id));
  }, [
    chats,
    receivedInterests,
    getProfileById,
    clearedNotificationIds,
    readIds,
  ]);

  const markAllRead = () => {
    markIdsAsRead(notifications.map(n => n.id));
  };

  const handleNotificationPress = (item: NotificationItem) => {
    // Mark as read
    markIdsAsRead([item.id]);

    // Navigate to respective screen
    if (item.type === 'message' && item.chatId) {
      navigateToChat(
        item.chatId,
        item.otherProfileId ?? '',
        item.fallbackName,
        item.fallbackPhoto,
      );
    } else if (item.type === 'like') {
      if (item.otherProfileId) {
        navigation.navigate('ProfileDetail', {
          profileId: item.otherProfileId,
        });
      } else {
        navigateToInterests();
      }
    } else if (item.type === 'system') {
      navigation.navigate('Verification');
    }
  };

  const handleClearAll = () => {
    clearNotifications(notifications.map(n => n.id));
  };

  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTexts}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Recent messages, interests, and updates
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {notifications.some(n => !n.read) && (
            <TouchableOpacity
              accessibilityRole="button"
              hitSlop={8}
              onPress={markAllRead}
            >
              <Text style={styles.markReadBtn}>Mark all read</Text>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleClearAll}
            >
              <Text style={[styles.markReadBtn, { color: '#EF4444' }]}>
                Clear
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="No notifications yet"
            description="We will notify you here when you receive new messages or interests."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, item.read ? styles.cardRead : null]}
            onPress={() => handleNotificationPress(item)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconWrapper,
                {
                  backgroundColor:
                    item.type === 'like'
                      ? '#F9EAF0'
                      : item.type === 'message'
                      ? '#EFF6FF'
                      : '#F1F5F9',
                },
              ]}
            >
              <Icon
                name={
                  item.type === 'like'
                    ? 'heart'
                    : item.type === 'message'
                    ? 'chatbubble-ellipses'
                    : 'notifications'
                }
                size={20}
                color={
                  item.type === 'like'
                    ? colors.primary
                    : item.type === 'message'
                    ? '#2563EB'
                    : '#64748B'
                }
              />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.notificationTitle,
                    item.read ? styles.textRead : null,
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
              <Text style={styles.body} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
            {!item.read && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexWrap: 'wrap',
    gap: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  headerTexts: {
    flexGrow: 1,
    flexBasis: 220,
  },
  title: {
    ...typeScale.display,
    fontSize: 32,
    color: colors.primaryDark,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  markReadBtn: {
    fontSize: fontSizes.xs + 1,
    color: colors.primary,
    fontWeight: '700',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 0,
    ...shadow.card,
  },
  cardRead: {
    opacity: 0.7,
    backgroundColor: colors.background,
  },
  textRead: {
    fontWeight: '600',
    color: '#475569',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notificationTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.text,
  },
  time: {
    fontSize: 10,
    color: colors.textLight,
    fontWeight: '600',
  },
  body: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    marginTop: 1,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
});
