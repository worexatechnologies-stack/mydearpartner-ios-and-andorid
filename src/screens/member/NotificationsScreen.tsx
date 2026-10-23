import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  DeviceEventEmitter,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import NotificationDiagnosticsCard from '../../components/NotificationDiagnosticsCard';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { SavedSearchAlert, savedSearchService } from '../../api/savedSearchService';
import {
  navigateToChat,
  navigateToInterests,
  navigateToSavedSearch,
} from '../../navigation/navigationRef';
import { RootStackParamList } from '../../navigation/types';
import { colors } from '../../theme/theme';
import { formatRelativeTime } from '../../utils/relativeTime';
import { accountStorageKey, getItem, setItem } from '../../utils/storage';
import { triggerHaptic } from '../../utils/haptics';
import {
  NotificationDiagnostics,
  notificationNextStep,
  readNotificationDiagnostics,
} from '../../services/NotificationDiagnostics';
import notifee from '@notifee/react-native';
import { CHANNEL_ID_MESSAGES } from '../../services/PushNotificationService';

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
  savedSearchId?: string;
}

type FilterTab = 'all' | 'message' | 'like' | 'system';

export default function NotificationsScreen({ navigation }: Props) {
  const { currentUser } = useAuth();
  const readStorageKey = accountStorageKey(READ_NOTIFS_KEY, currentUser?.id ?? 'signed-out');
  const [savedSearchAlerts, setSavedSearchAlerts] = useState<SavedSearchAlert[]>([]);
  const {
    receivedInterests,
    chats,
    getProfileById,
    clearedNotificationIds,
    clearNotifications,
  } = useAppData();

  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);

  // Load persisted read notification IDs on mount
  useEffect(() => {
    let active = true;
    let revision = 0;
    setReadIds(new Set());
    setSavedSearchAlerts([]);
    getItem<string[]>(readStorageKey).then(saved => {
      if (active && saved && Array.isArray(saved)) {
        setReadIds(new Set(saved));
      }
    });
    const loadAlerts = async () => {
      if (!currentUser?.id) return;
      const started = ++revision;
      try {
        const alerts = await savedSearchService.alerts();
        if (active && started === revision) setSavedSearchAlerts(alerts);
      } catch { /* Existing app versions can run before the feature is deployed. */ }
    };
    loadAlerts();
    const refresh = DeviceEventEmitter.addListener('REFRESH_SAVED_SEARCH_ALERTS', loadAlerts);
    const focus = navigation.addListener('focus', loadAlerts);

    // Check notification health quietly in background
    readNotificationDiagnostics().then(setDiagnostics).catch(() => {});
    return () => { active = false; refresh.remove(); focus(); };
  }, [currentUser?.id, readStorageKey, navigation]);

  const markIdsAsRead = useCallback((ids: string[]) => {
    setReadIds(prev => {
      const next = new Set([...prev, ...ids]);
      setItem(readStorageKey, Array.from(next));
      return next;
    });
    for (const id of ids) {
      if (id.startsWith('saved-search-')) savedSearchService.readAlert(id.slice('saved-search-'.length)).catch(() => {});
    }
  }, [readStorageKey]);

  // Generate dynamic notifications from real chats and interests
  const notifications = useMemo(() => {
    const list: NotificationItem[] = [];
    savedSearchAlerts.forEach(alert => list.push({
      id: `saved-search-${alert.id}`, title: alert.title, body: alert.message,
      time: formatRelativeTime(Date.parse(alert.created_at)), read: alert.is_read || readIds.has(`saved-search-${alert.id}`),
      type: 'system', savedSearchId: alert.search_id,
    }));

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
        body: 'Complete your profile to help compatible members discover you.',
        time: 'Just now',
        read: true,
        type: 'system',
      });
    }

    return list.filter(n => !clearedNotificationIds.includes(n.id));
  }, [
    chats,
    receivedInterests,
    getProfileById,
    clearedNotificationIds,
    readIds,
    savedSearchAlerts,
  ]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const markAllRead = () => {
    triggerHaptic('light');
    markIdsAsRead(notifications.map(n => n.id));
  };

  const handleClearAll = () => {
    triggerHaptic('medium');
    clearNotifications(notifications.map(n => n.id));
  };

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter(n => n.type === activeTab);
  }, [notifications, activeTab]);

  const counts = useMemo(
    () => ({
      all: notifications.length,
      message: notifications.filter(n => n.type === 'message').length,
      like: notifications.filter(n => n.type === 'like').length,
      system: notifications.filter(n => n.type === 'system').length,
    }),
    [notifications],
  );

  const handleNotificationPress = (item: NotificationItem) => {
    triggerHaptic('light');
    markIdsAsRead([item.id]);
    if (item.savedSearchId) { navigateToSavedSearch(item.savedSearchId); return; }

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

  const nextStep = diagnostics ? notificationNextStep(diagnostics) : null;
  const hasDiagnosticWarning = nextStep && nextStep.action !== 'none';

  const handleFixDiagnostics = () => {
    if (!nextStep) return;
    if (nextStep.action === 'messages') {
      notifee.openNotificationSettings(CHANNEL_ID_MESSAGES).catch(() => {});
    } else {
      notifee.openNotificationSettings().catch(() => {});
    }
  };

  const handleBack = () => {
    triggerHaptic('light');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Main', { screen: 'Discover' });
    }
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} style={styles.container}>
      {/* 1. Sleek Navigation Header */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="arrow-back" size={20} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadPill}>
                <Text style={styles.unreadPillText}>{unreadCount} new</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={() => setShowDiagnosticsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Notification health diagnostics"
          >
            <Icon
              name={hasDiagnosticWarning ? 'alert-circle' : 'shield-checkmark-outline'}
              size={20}
              color={hasDiagnosticWarning ? '#D97706' : '#6B7280'}
            />
          </TouchableOpacity>

          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.textActionButton}
              onPress={markAllRead}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.clearIconButton}
              onPress={handleClearAll}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              <Icon name="trash-outline" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Compact Alert Banner (Only shown if notifications are actually blocked!) */}
      {hasDiagnosticWarning && (
        <View style={styles.warningBanner}>
          <View style={styles.warningIconCircle}>
            <Icon name="notifications-off-outline" size={16} color="#D97706" />
          </View>
          <View style={styles.warningTextContainer}>
            <Text style={styles.warningTitle}>{nextStep.title}</Text>
            <Text style={styles.warningSubtitle} numberOfLines={1}>
              {nextStep.body}
            </Text>
          </View>
          <TouchableOpacity style={styles.warningFixBtn} onPress={handleFixDiagnostics}>
            <Text style={styles.warningFixBtnText}>Fix</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 3. Modern Category Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={1}
          contentContainerStyle={styles.tabsScrollContent}
        >
          {[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'message', label: 'Chats', count: counts.message },
            { id: 'like', label: 'Interests', count: counts.like },
            { id: 'system', label: 'Updates', count: counts.system },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabChip, isActive && styles.tabChipActive]}
                onPress={() => {
                  triggerHaptic('light');
                  setActiveTab(tab.id as FilterTab);
                }}
                activeOpacity={0.8}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                    <Text
                      style={[
                        styles.tabBadgeText,
                        isActive && styles.tabBadgeTextActive,
                      ]}
                    >
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 4. Notification Items Feed */}
      <FlatList
        data={displayedNotifications}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={1}
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        initialNumToRender={8}
        windowSize={7}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Icon name="notifications-outline" size={36} color={colors.action} />
            </View>
            <Text style={styles.emptyTitle}>All caught up! 🎉</Text>
            <Text style={styles.emptyDescription}>
              You have no new notifications right now. When someone likes your profile or sends a message, it will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptyExploreBtn}
              onPress={() => {
                triggerHaptic('light');
                navigation.navigate('Main', { screen: 'Discover' });
              }}
            >
              <Text style={styles.emptyExploreBtnText}>Explore Matches</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const isUnread = !item.read;
          return (
            <TouchableOpacity
              style={[styles.notificationCard, isUnread && styles.notificationCardUnread]}
              onPress={() => handleNotificationPress(item)}
              activeOpacity={0.7}
            >
              {/* Left Avatar / Type Icon */}
              <View style={styles.avatarWrapper}>
                {item.fallbackPhoto ? (
                  <Image
                    source={{ uri: item.fallbackPhoto }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      {
                        backgroundColor:
                          item.type === 'like'
                            ? '#FDF2F8'
                            : item.type === 'message'
                            ? '#EFF6FF'
                            : '#F3F4F6',
                      },
                    ]}
                  >
                    <Icon
                      name={
                        item.type === 'like'
                          ? 'heart'
                          : item.type === 'message'
                          ? 'chatbubble-ellipses'
                          : 'sparkles'
                      }
                      size={22}
                      color={
                        item.type === 'like'
                          ? colors.action
                          : item.type === 'message'
                          ? '#2563EB'
                          : '#6B7280'
                      }
                    />
                  </View>
                )}

                {/* Micro-badge on avatar corner */}
                {item.fallbackPhoto && (
                  <View
                    style={[
                      styles.avatarMicroBadge,
                      {
                        backgroundColor:
                          item.type === 'like' ? colors.action : '#2563EB',
                      },
                    ]}
                  >
                    <Icon
                      name={item.type === 'like' ? 'heart' : 'chatbubble'}
                      size={9}
                      color="#FFFFFF"
                    />
                  </View>
                )}
              </View>

              {/* Middle Text Content */}
              <View style={styles.textContent}>
                <View style={styles.cardHeaderRow}>
                  <Text
                    style={[
                      styles.cardTitle,
                      isUnread && styles.cardTitleUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text style={styles.cardTime}>{item.time}</Text>
                </View>
                <Text style={styles.cardBody} numberOfLines={2}>
                  {item.body}
                </Text>
              </View>

              {/* Right Side: Unread dot or chevron */}
              <View style={styles.rightColumn}>
                {isUnread ? (
                  <View style={styles.unreadGlowDot} />
                ) : (
                  <Icon name="chevron-forward" size={16} color="#D1D5DB" />
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* 5. Diagnostics Health Modal (Clean slide-up info sheet) */}
      <Modal
        visible={showDiagnosticsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDiagnosticsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Diagnostics</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowDiagnosticsModal(false)}
              >
                <Icon name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <NotificationDiagnosticsCard />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F7',
  },

  /* 1. Top Bar Navigation */
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.4,
  },
  unreadPill: {
    backgroundColor: '#FDF2F8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FBCFE8',
  },
  unreadPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.action,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textActionButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#FDF2F8',
  },
  markReadText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.action,
  },

  /* 2. Compact Alert Banner */
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  warningIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTextContainer: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  warningSubtitle: {
    fontSize: 11.5,
    color: '#B45309',
    marginTop: 1,
  },
  warningFixBtn: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  warningFixBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  /* 3. Category Filter Tabs */
  tabsWrapper: {
    paddingBottom: 8,
  },
  tabsScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tabChipActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  tabChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  tabChipTextActive: {
    color: colors.action,
    fontWeight: '700',
  },
  tabBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  tabBadgeActive: {
    backgroundColor: colors.action,
  },
  tabBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabBadgeTextActive: {
    color: '#FFFFFF',
  },

  /* 4. Notification Items Feed */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  notificationCardUnread: {
    borderColor: '#FCE7F3',
    backgroundColor: '#FFFFFF',
    shadowOpacity: 0.07,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMicroBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  textContent: {
    flex: 1,
    justifyContent: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    marginRight: 8,
  },
  cardTitleUnread: {
    fontWeight: '700',
    color: '#111827',
  },
  cardTime: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  cardBody: {
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  rightColumn: {
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadGlowDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.action,
  },

  /* Empty State */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 28,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FDF2F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptyDescription: {
    fontSize: 14.5,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    maxWidth: 300,
  },
  emptyExploreBtn: {
    backgroundColor: colors.action,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 100,
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyExploreBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.2,
  },

  /* 5. Diagnostics Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
