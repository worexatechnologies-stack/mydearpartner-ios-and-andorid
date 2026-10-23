import { useProfilePager } from '../../hooks/useProfilePager';
import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  FlatList,
  Platform,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import AnimatedButton from '../../components/AnimatedButton';
import AuthImage from '../../components/AuthImage';
import EmptyState from '../../components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';
import ScreenContainer from '../../components/ScreenContainer';
import MotionView from '../../components/MotionView';
import { SkeletonList } from '../../components/SkeletonCard';
import UndoSnackbar, { UndoSnackbarRef } from '../../components/UndoSnackbar';
import { useAppData } from '../../context/AppDataContext';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { colors, fontSizes, radii, spacing } from '../../theme/theme';
import { Interest } from '../../types/models';
import { triggerHaptic } from '../../utils/haptics';
import { isInterestQuotaError } from '../../utils/interestErrors';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Interests'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Tab = 'received' | 'sent' | 'shortlisted' | 'connected';

export default function InterestsScreen({ navigation }: Props) {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const {
    pageHeight,
    pagingEnabled,
    onLayout: measureViewport,
  } = useProfilePager();
  const [tab, setTab] = useState<Tab>('received');
  const [refreshing, setRefreshing] = useState(false);
  const snackbarRef = useRef<UndoSnackbarRef>(null);
  const allowance = usePlanAllowance();
  const {
    sentInterests,
    receivedInterests,
    shortlistedProfiles,
    getProfileById,
    respondToInterest,
    getOrCreateChatWith,
    isShortlisted,
    toggleShortlist,
    sendInterest,
    cancelInterest,
    interestStatusFor,
    refreshInterests,
    isLoadingProfiles,
    interestsError,
  } = useAppData();

  // Ensure uniqueness to prevent React key duplication errors
  const uniqueByKey = (arr: any[], key = 'id') => {
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item[key])) return false;
      seen.add(item[key]);
      return true;
    });
  };

  const activeReceived = receivedInterests.filter(i => i.status === 'pending');
  const activeSent = sentInterests.filter(i => i.status === 'pending');
  const connectedInterests = uniqueByKey(
    [
      ...receivedInterests
        .filter(i => i.status === 'accepted')
        .map(i => ({
          ...i,
          otherUserId: i.fromUserId,
          otherProfile: i.senderProfile,
        })),
      ...sentInterests
        .filter(i => i.status === 'accepted')
        .map(i => ({
          ...i,
          otherUserId: i.toUserId,
          otherProfile: i.receiverProfile,
        })),
    ],
    'otherUserId',
  );
  const safeShortlistedProfiles = uniqueByKey(shortlistedProfiles);

  useFocusEffect(
    useCallback(() => {
      refreshInterests();
    }, [refreshInterests]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('REFRESH_INTERESTS', () => {
      refreshInterests();
    });
    return () => sub.remove();
  }, [refreshInterests]);

  const handleSendInterest = async (profileId: string, userId?: string) => {
    if (allowance.isInterestsExhausted) {
      Alert.alert(
        'Daily Interest Limit Reached',
        `You have reached your daily limit of ${allowance.interestsLimit} interests on the ${allowance.planName} plan. Upgrade your plan to send more interests today.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upgrade Plan',
            onPress: () => navigation.navigate('Membership'),
          },
        ],
      );
      return;
    }

    try {
      await sendInterest(profileId, userId);
      try {
        const { showInAppNotification } = require('../../utils/notifications');
        showInAppNotification({
          title: 'Request Sent! ❤️',
          message: 'Interest request sent successfully',
          icon: 'heart',
          type: 'interest',
        });
      } catch {
        // ignore
      }
      Alert.alert(
        'Request Sent! ❤️',
        "Your interest request has been sent. We'll notify you as soon as they respond!",
        [{ text: 'Awesome', style: 'default' }],
      );
    } catch (err: any) {
      const isLimitError = isInterestQuotaError(err);
      if (isLimitError) {
        allowance.markDailyInterestsExhausted(true);
        Alert.alert(
          'Daily Interest Limit Reached',
          err?.message ||
            `You have reached your daily limit of ${allowance.interestsLimit} interests on the ${allowance.planName} plan. Upgrade your plan to send more interests today.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade Plan',
              onPress: () => navigation.navigate('Membership'),
            },
          ],
        );
      } else {
        Alert.alert('Notice', err?.message ?? 'Could not send interest.');
      }
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshInterests();
    } finally {
      setRefreshing(false);
    }
  };

  const statusLabel = (status: Interest['status']) => {
    if (status === 'pending') return tab === 'received' ? 'New' : 'Pending';
    if (status === 'accepted') return 'Connected';
    return 'Declined';
  };

  const statusBadgeStyle = (status: Interest['status']) => {
    if (status === 'pending') {
      return {
        bg: colors.surfaceTint,
        text: '#B23E69',
        border: '#F3D8E3',
      };
    }
    if (status === 'accepted') {
      return {
        bg: 'rgba(16,185,129,0.2)',
        text: '#10B981',
        border: 'rgba(16,185,129,0.5)',
      };
    }
    return {
      bg: 'rgba(239,68,68,0.2)',
      text: '#EF4444',
      border: 'rgba(239,68,68,0.5)',
    };
  };

  const renderMatchCard = (profile: any, item?: any, tabType?: Tab, index: number = 0) => {
    const isSaved = isShortlisted(profile.id);
    const status = item ? interestStatusFor(profile.id) : null;

    let rightBadge = null;
    if (item && item.status) {
      const badgeStyles = statusBadgeStyle(item.status);
      rightBadge = (
        <View
          style={[
            styles.statusBadgeGlass,
            {
              backgroundColor: badgeStyles.bg,
              borderColor: badgeStyles.border,
            },
          ]}
        >
          <Text style={[styles.statusTextGlass, { color: badgeStyles.text }]}>
            {statusLabel(item.status)}
          </Text>
        </View>
      );
    } else if (tabType === 'shortlisted' && status) {
      rightBadge = (
        <View
          style={[
            styles.statusBadgeGlass,
            {
              backgroundColor: 'rgba(16,185,129,0.2)',
              borderColor: 'rgba(16,185,129,0.5)',
            },
          ]}
        >
          <Text style={[styles.statusTextGlass, { color: '#10B981' }]}>
            Interest Sent
          </Text>
        </View>
      );
    }

    let bottomActions = null;
    if (tabType === 'shortlisted' && !status) {
      bottomActions = (
        <TouchableOpacity
          style={styles.glassActionBtn}
          onPress={() => {
            triggerHaptic('light');
            handleSendInterest(profile.id, profile.userId);
          }}
        >
          <LinearGradient
            colors={colors.gradientPrimary}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Icon name="heart" size={16} color="#FFF" />
          <Text style={styles.glassActionText}>Send Interest</Text>
        </TouchableOpacity>
      );
    } else if (tabType === 'received' && item?.status === 'pending') {
      bottomActions = (
        <View style={styles.dualActions}>
          <TouchableOpacity
            style={[styles.glassActionBtn, { flex: 1 }]}
            onPress={() => {
              triggerHaptic('success');
              respondToInterest(item.id, 'accepted');
            }}
          >
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Text style={styles.glassActionText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.glassActionBtnSecondary, { flex: 1 }]}
            onPress={() => {
              triggerHaptic('light');
              // U12: Show undo snackbar instead of immediately declining
              respondToInterest(item.id, 'declined');
              snackbarRef.current?.show('Interest declined', () =>
                respondToInterest(item.id, 'accepted'),
              );
            }}
          >
            <Text style={styles.glassActionTextSecondary}>Decline</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (tabType === 'sent' && item?.status === 'pending') {
      bottomActions = (
        <TouchableOpacity
          style={styles.glassActionBtnSecondary}
          onPress={async () => {
            triggerHaptic('light');
            try {
              await cancelInterest(item.id);
            } catch (err: any) {
              Alert.alert('Notice', err?.message ?? 'Could not unsend interest.');
            }
          }}
        >
          <Text style={styles.glassActionTextSecondary}>Unsend Interest</Text>
        </TouchableOpacity>
      );
    } else if (item?.status === 'accepted') {
      bottomActions = (
        <View style={styles.dualActions}>
        <TouchableOpacity
          style={[styles.glassActionBtn, { flex: 1 }]}
          onPress={async () => {
            triggerHaptic('light');
            if (!allowance.isPremium) {
              Alert.alert(
                'Premium Required',
                'Chatting is reserved for Premium members. Upgrade to Gold or Elite to start chatting.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'View Plans',
                    onPress: () => navigation.navigate('Membership'),
                  },
                ],
              );
              return;
            }
            try {
              const chat = await getOrCreateChatWith(profile.id);
              navigation.navigate('Chat', {
                chatId: chat.id,
                otherProfileId: profile.id,
              });
            } catch (err: any) {
              if (
                err?.status === 403 ||
                err?.isAuthError ||
                err?.message?.toLowerCase().includes('permission') ||
                err?.message?.toLowerCase().includes('plan') ||
                err?.message?.toLowerCase().includes('upgrade')
              ) {
                Alert.alert(
                  'Direct Messaging',
                  'Direct messaging requires a mutual connection or an upgraded membership plan. Upgrade your plan to chat directly with verified matches!',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'View Plans',
                      onPress: () => navigation.navigate('Membership'),
                    },
                  ],
                );
              } else {
                Alert.alert('Notice', err?.message ?? 'Could not start conversation.');
              }
            }
          }}
        >
          <LinearGradient
            colors={['#059669', '#10B981']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Icon
            name="chatbubble-ellipses"
            size={16}
            color="#FFF"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.glassActionText}>Chat with Match</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Unconnect"
          style={[styles.glassActionBtnSecondary, { flex: 1 }]}
          onPress={() => Alert.alert('Unconnect?', 'This will remove your connection with this member.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Unconnect', style: 'destructive', onPress: async () => {
              try {
                await cancelInterest(item.id);
              } catch (error) {
                Alert.alert('Could not unconnect', error instanceof Error ? error.message : 'Please try again.');
              }
            } },
          ])}
        >
          <Text style={styles.glassActionTextSecondary}>Unconnect</Text>
        </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.profilePage, { height: pageHeight }]}>
        <MotionView index={index} replayKey={tabType} style={{ width: '100%', height: '100%' }}>
          <TouchableOpacity
            activeOpacity={0.95}
            onPress={() =>
              navigation.navigate('ProfileDetail', { profileId: profile.id })
            }
            style={styles.matchCard}
          >
          <View style={styles.matchPhotoWrap}>
            <AuthImage
              source={{ uri: profile.photo || profile.photos?.[0] }}
              fallbackLabel="Photo unavailable"
              showLoading
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </View>
          <View style={styles.matchCardTop}>
            <View style={styles.matchCardBadge}>
              <Icon name="person" size={11} color="#FBBF24" />
              <Text style={styles.matchCardBadgeText}> {profile.age} Yrs</Text>
            </View>
            <View style={styles.matchCardTopRight}>
              {rightBadge}
              <TouchableOpacity
                style={[styles.glassHeart, isSaved && styles.glassHeartActive]}
                onPress={() => {
                  triggerHaptic('light');
                  toggleShortlist(profile.id);
                }}
              >
                <Icon
                  name={isSaved ? 'heart' : 'heart-outline'}
                  size={18}
                  color={isSaved ? colors.action : '#806574'}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.matchCardBottom}>
            <View style={{ marginBottom: bottomActions ? 16 : 0 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <Text style={styles.matchName} numberOfLines={1}>
                  {profile.name.split(' ')[0]}
                </Text>
                {profile.isVerified && (
                  <View style={styles.verifiedDot}>
                    <Icon name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </View>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
              >
                <Icon name="location-outline" size={12} color="#8B7380" />
                <Text style={styles.matchCity} numberOfLines={1}>
                  {[profile.city, profile.profession || profile.education]
                    .filter(Boolean)
                    .join(' • ')}
                </Text>
              </View>
            </View>
            {bottomActions}
          </View>
        </TouchableOpacity>
        </MotionView>
        <Text style={styles.nextHint}>Scroll down for next profile ↓</Text>
      </View>
    );
  };

  return (
    <ScreenContainer style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.activityEyebrow}>YOUR CONNECTIONS</Text>
            <Text accessibilityRole="header" style={styles.activityTitle}>
              Activity
            </Text>
          </View>
          <View
            style={[
              styles.quotaBadge,
              allowance.isInterestsExhausted && styles.quotaBadgeExhausted,
            ]}
          >
            <Icon
              name="heart"
              size={12}
              color={
                allowance.isInterestsExhausted ? colors.danger : colors.primary
              }
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.quotaBadgeText,
                allowance.isInterestsExhausted &&
                  styles.quotaBadgeTextExhausted,
              ]}
            >
              {allowance.interestsRemaining} of {allowance.interestsLimit} left
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={1}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabs}
      >
        <AnimatedButton
          style={[
            styles.tabButton,
            tab === 'connected' && styles.tabButtonActive,
          ]}
          onPress={() => setTab('connected')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'connected' && styles.tabTextActive,
            ]}
          >
            Connected ({connectedInterests.length})
          </Text>
        </AnimatedButton>
        <AnimatedButton
          style={[
            styles.tabButton,
            tab === 'received' && styles.tabButtonActive,
          ]}
          onPress={() => setTab('received')}
        >
          <Text
            style={[styles.tabText, tab === 'received' && styles.tabTextActive]}
          >
            Received ({activeReceived.length})
          </Text>
        </AnimatedButton>
        <AnimatedButton
          style={[styles.tabButton, tab === 'sent' && styles.tabButtonActive]}
          onPress={() => setTab('sent')}
        >
          <Text
            style={[styles.tabText, tab === 'sent' && styles.tabTextActive]}
          >
            Sent ({activeSent.length})
          </Text>
        </AnimatedButton>
        <AnimatedButton
          style={[
            styles.tabButton,
            tab === 'shortlisted' && styles.tabButtonActive,
          ]}
          onPress={() => setTab('shortlisted')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'shortlisted' && styles.tabTextActive,
            ]}
          >
            Saved ({shortlistedProfiles.length})
          </Text>
        </AnimatedButton>
      </ScrollView>

      {interestsError ? (
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.errorText}>{interestsError} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}
      <View
        style={[
          styles.feedViewport,
          {
            marginBottom:
              tabBarHeight +
              Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) +
              8,
          },
        ]}
        onLayout={measureViewport}
      >
        {tab === 'shortlisted' ? (
          <FlatList
            data={safeShortlistedProfiles}
            keyExtractor={item => item.id}
            key={`${tab}-${pageHeight}`}
            style={styles.feedList}
            pagingEnabled={pagingEnabled}
            snapToInterval={pageHeight || undefined}
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={1}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={4}
            windowSize={5}
            getItemLayout={
              pageHeight > 0
                ? (_, index) => ({
                    length: pageHeight,
                    offset: pageHeight * index,
                    index,
                  })
                : undefined
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              isLoadingProfiles ? (
                <SkeletonList count={3} />
              ) : (
                <EmptyState
                  icon="heart-outline"
                  title="No saved profiles"
                  description="Tap the heart icon on any profile in Discover or Search to bookmark it here."
                />
              )
            }
            renderItem={({ item, index }) =>
              renderMatchCard(item, null, 'shortlisted', index)
            }
          />
        ) : (
          <FlatList
            data={
              tab === 'connected'
                ? connectedInterests
                : tab === 'received'
                ? uniqueByKey(activeReceived)
                : uniqueByKey(activeSent)
            }
            keyExtractor={item => item.id}
            key={`${tab}-${pageHeight}`}
            style={styles.feedList}
            pagingEnabled={pagingEnabled}
            snapToInterval={pageHeight || undefined}
            decelerationRate="fast"
            disableIntervalMomentum
            scrollEventThrottle={1}
            removeClippedSubviews={Platform.OS === 'android'}
            maxToRenderPerBatch={4}
            windowSize={5}
            getItemLayout={
              pageHeight > 0
                ? (_, index) => ({
                    length: pageHeight,
                    offset: pageHeight * index,
                    index,
                  })
                : undefined
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              isLoadingProfiles ? (
                <SkeletonList count={4} />
              ) : (
                <EmptyState
                  icon="mail-unread-outline"
                  title={
                    tab === 'connected'
                      ? 'No connections yet'
                      : tab === 'received'
                      ? 'No interests received yet'
                      : 'No interests sent yet'
                  }
                  description={
                    tab === 'connected'
                      ? 'Accepted interests appear here. Start a conversation when you connect.'
                      : tab === 'received'
                      ? 'When someone likes your profile, it will show up here.'
                      : 'Browse Discover or Search to send interest to profiles you like.'
                  }
                />
              )
            }
            renderItem={({ item, index }) => {
              const otherId =
                tab === 'connected'
                  ? item.otherUserId
                  : tab === 'received'
                  ? item.fromUserId
                  : item.toUserId;
              const embeddedProfile =
                tab === 'connected'
                  ? item.otherProfile
                  : tab === 'received'
                  ? item.senderProfile
                  : item.receiverProfile;
              const cachedProfile =
                getProfileById(otherId) ||
                (embeddedProfile?.id
                  ? getProfileById(embeddedProfile.id)
                  : undefined);
              const profile = cachedProfile || embeddedProfile;
              const displayProfile = profile
                ? {
                    ...embeddedProfile,
                    ...profile,
                    photo:
                      cachedProfile?.photo ||
                      embeddedProfile?.photo ||
                      cachedProfile?.photos?.[0] ||
                      embeddedProfile?.photos?.[0],
                  }
                : undefined;
              if (!profile)
                return (
                  <View style={{ height: pageHeight }}>
                    <EmptyState
                      icon="person-outline"
                      title="Profile unavailable"
                      description="This member's profile could not be loaded. Refresh to try again."
                      buttonText="Retry"
                      onButtonPress={handleRefresh}
                    />
                  </View>
                );
              return renderMatchCard(displayProfile, item, tab, index);
            }}
          />
        )}
      </View>
      {/* U12: Undo snackbar for declined interests */}
      <UndoSnackbar ref={snackbarRef} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  tabs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
    paddingRight: 8,
  },
  tabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
    minHeight: 56,
    marginTop: 14,
    marginBottom: 16,
  },
  headingCopy: { flexShrink: 1 },
  activityEyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: '#B23E69',
    fontWeight: '700',
    marginBottom: 4,
  },
  activityTitle: { fontSize: 26, color: '#302330', fontWeight: '800' },
  feedViewport: { flex: 1, minHeight: 0 },
  feedList: { flex: 1 },
  profilePage: { paddingTop: 4, alignItems: 'center' },
  nextHint: { height: 28, paddingTop: 7, fontSize: 11, color: '#8B7380' },
  errorText: { fontSize: 12, color: colors.danger, marginBottom: 8 },
  matchPhotoWrap: {
    flex: 1,
    minHeight: 80,
    backgroundColor: '#F2E6EC',
    borderRadius: 16,
    overflow: 'hidden',
  },
  tabButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: '#F2E6EC',
  },
  tabButtonActive: {
    backgroundColor: colors.action,
  },
  tabText: {
    lineHeight: 20,
    fontSize: fontSizes.xs + 1,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  listContent: {
    flexGrow: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  quotaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  quotaBadgeExhausted: {
    backgroundColor: colors.dangerLight,
    borderColor: '#FECACA',
  },
  quotaBadgeText: {
    fontSize: fontSizes.xs - 1,
    fontWeight: '800',
    color: colors.primary,
  },
  quotaBadgeTextExhausted: {
    color: colors.danger,
  },

  // Match Card Redesign
  matchCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.roseBorder,
    flex: 1,
    minHeight: 0,
    maxWidth: 560,
  },
  matchCardPhoto: {
    width: '100%',
    height: '100%',
  },
  matchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  matchCardTopRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  matchCardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  matchCardBadgeText: {
    color: '#806574',
    fontSize: 12,
    fontWeight: '800',
  },
  statusBadgeGlass: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusTextGlass: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  glassHeart: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassHeartActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: '#FFF',
  },
  matchCardBottom: {
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  matchName: {
    flexShrink: 1,
    fontSize: 22,
    fontWeight: '800',
    color: '#302330',
  },
  verifiedDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  matchCity: {
    flexShrink: 1,
    fontSize: 12,
    color: '#8B7380',
  },
  matchActions: {
    marginTop: 16,
  },
  dualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  glassActionBtn: {
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  glassActionBtnSecondary: {
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  glassActionText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  glassActionTextSecondary: {
    color: '#B23E69',
    fontSize: 15,
    fontWeight: '800',
  },
});
