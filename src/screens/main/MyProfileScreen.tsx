import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import AnimatedButton from '../../components/AnimatedButton';
import AuthImage from '../../components/AuthImage';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { usePlanAllowance } from '../../utils/planAllowance';

import ProfileCompletionBanner from '../../components/ProfileCompletionBanner';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { colors, radii, shadow, typeScale } from '../../theme/theme';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MyProfile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function MyProfileScreen({ navigation }: Props) {
  const { currentUser, logout, refreshCurrentUser } = useAuth();
  const {
    receivedInterests,
    sentInterests,
    chats,
    getProfileById,
    totalUnreadCount,
  } = useAppData();
  const allowance = usePlanAllowance();
  const { refreshUsage } = allowance;
  const profile = currentUser?.profile;
  const isPremium = allowance.isPremium;
  const planConfig = allowance.planConfig;
  const planName = planConfig.name;

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const notificationCount =
    totalUnreadCount +
    receivedInterests.filter(interest => interest.status === 'pending').length;
  const { width, fontScale } = useWindowDimensions();
  const stackCards = width < 360 || fontScale > 1.3;
  const isNarrow = width < 360;

  useFocusEffect(
    useCallback(() => {
      refreshUsage();
      refreshCurrentUser().catch(() => {});
    }, [refreshUsage, refreshCurrentUser]),
  );

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      pulseAnim.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim, reducedMotion]);

  if (!profile) {
    return (
      <ScreenContainer style={styles.centered}>
        <Text>No profile found.</Text>
      </ScreenContainer>
    );
  }

  const latestInterest =
    receivedInterests.length > 0
      ? receivedInterests[receivedInterests.length - 1]
      : null;
  const recentProfile = latestInterest
    ? getProfileById(latestInterest.fromUserId)
    : null;

  const handleToolPress = (route: string) => {
    navigation.navigate(route as any);
  };

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Check out my profile on MyDearPartner! mydearpartner://profile/${profile.id}`,
        url: `mydearpartner://profile/${profile.id}`,
        title: 'MyDearPartner Profile',
      });
    } catch {}
  };

  const HEADER_HEIGHT = 170;
  const topPadding =
    Platform.OS === 'android'
      ? Math.max(insets.top, 40)
      : Math.max(insets.top, 20);

  // Parallax Header translation
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, HEADER_HEIGHT],
    outputRange: [0, -HEADER_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  return (
    <ScreenContainer style={styles.container} edges={['left', 'right']}>
      {/* Parallax Hero Background */}
      <Animated.View
        style={[
          styles.heroBackgroundContainer,
          {
            height: HEADER_HEIGHT,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
      >
        <LinearGradient
          colors={['#FFE1EC', colors.surfaceTint, colors.background]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Floating Glass Top Nav */}
      <View style={[styles.topNav, { paddingTop: topPadding }]}>
        <Text style={styles.navTitle}>Your space</Text>
        <View style={[styles.navActions, isNarrow && { gap: 6 }]}>
          <AnimatedButton
            style={[styles.navBtnGlass, isNarrow && styles.navBtnGlassSmall]}
            accessibilityLabel="Share profile"
            onPress={handleShareProfile}
          >
            <Icon
              name="share-social"
              size={isNarrow ? 17 : 20}
              color="#B23E69"
            />
          </AnimatedButton>
          <AnimatedButton
            style={[styles.navBtnGlass, isNarrow && styles.navBtnGlassSmall]}
            accessibilityLabel="Notifications"
            onPress={() => handleToolPress('Notifications')}
          >
            <Icon
              name="notifications-outline"
              size={isNarrow ? 17 : 20}
              color="#B23E69"
            />
            {notificationCount > 0 && <View style={styles.notificationDot} />}
          </AnimatedButton>
          <AnimatedButton
            style={[styles.navBtnGlass, isNarrow && styles.navBtnGlassSmall]}
            accessibilityLabel="Settings"
            onPress={() => handleToolPress('Settings')}
          >
            <Icon name="settings" size={isNarrow ? 17 : 20} color="#B23E69" />
          </AnimatedButton>
        </View>
      </View>

      {/* Main Scrollable Content */}
      <Animated.ScrollView
        style={{
          flex: 1,
          marginBottom:
            tabBarHeight + Math.max(insets.bottom, FLOATING_TAB_BAR_BOTTOM) + 8,
        }}
        contentContainerStyle={{
          paddingTop: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={1}
      >
        {/* U11: Profile completion progress banner */}
        <ProfileCompletionBanner
          onPress={() => navigation.navigate('EditProfile')}
        />
        {/* Profile Info Section */}
        <View style={styles.profileInfoSection}>
          <View style={styles.avatarContainer}>
            <AuthImage
              source={{ uri: profile.photo }}
              style={[styles.avatarMain, isPremium && styles.avatarMainGold]}
            />
            {profile.isVerified && (
              <Animated.View
                style={[
                  styles.verifiedPulse,
                  { transform: [{ scale: pulseAnim }] },
                ]}
              >
                <View style={styles.verifiedBadgeInner}>
                  <Icon name="checkmark-done" size={14} color="#FFF" />
                </View>
              </Animated.View>
            )}
            {isPremium && (
              <View style={styles.premiumBadge}>
                <LinearGradient
                  colors={['#FBBF24', '#F59E0B']}
                  style={StyleSheet.absoluteFill}
                />
                <Icon name="star" size={14} color="#FFF" />
              </View>
            )}
          </View>

          <Text style={styles.profileName}>
            {profile.name}
            {profile.isVerified && (
              <Icon
                name="shield-checkmark"
                size={20}
                color="#FBBF24"
                style={{ marginLeft: 6 }}
              />
            )}
          </Text>
          <Text style={styles.profileSub}>
            {profile.age} yrs • {profile.city}
            {profile.state ? `, ${profile.state}` : ''}
          </Text>

          {/* Quick attribute tags */}
          <View style={styles.heroTagsRow}>
            {profile.height ? (
              <View style={styles.heroTagPill}>
                <Icon
                  name="resize-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.heroTagText}>{profile.height}</Text>
              </View>
            ) : null}
            {profile.religion ? (
              <View style={styles.heroTagPill}>
                <Icon
                  name="flower-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.heroTagText}>
                  {profile.religion}
                  {profile.caste ? ` • ${profile.caste}` : ''}
                </Text>
              </View>
            ) : null}
            {profile.profession ? (
              <View style={styles.heroTagPill}>
                <Icon
                  name="briefcase-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.heroTagText}>{profile.profession}</Text>
              </View>
            ) : null}
            {profile.managedBy ? (
              <View style={styles.heroTagPill}>
                <Icon
                  name="people-outline"
                  size={12}
                  color={colors.primary}
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.heroTagText}>
                  Managed by {profile.managedBy}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Action buttons side-by-side */}
          <View style={styles.heroActionsRow}>
            <AnimatedButton
              style={styles.heroPreviewBtn}
              onPress={() =>
                navigation.navigate('ProfileDetail', { profileId: profile.id })
              }
              accessibilityLabel="Preview Public Profile"
            >
              <LinearGradient
                colors={[colors.action, colors.actionDark]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Icon
                name="eye-outline"
                size={15}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.heroPreviewBtnText}>Preview Profile</Text>
            </AnimatedButton>

            <AnimatedButton
              style={styles.heroEditBtn}
              onPress={() => handleToolPress('EditProfile')}
              accessibilityLabel="Edit Profile"
            >
              <LinearGradient
                colors={['rgba(165,55,96,0.12)', 'rgba(165,55,96,0.06)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Icon
                name="pencil"
                size={14}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.heroEditBtnText}>Edit Profile</Text>
            </AnimatedButton>
          </View>
        </View>

        {/* Dashboard Content Grid */}
        <View style={styles.contentGrid}>
          {/* VIP Upgrade Banner */}
          <AnimatedButton
            style={styles.vipBanner}
            onPress={() => {
              handleToolPress('Membership');
            }}
          >
            <LinearGradient
              colors={colors.gradientDark}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Subtle light reflections */}
            <LinearGradient
              colors={
                isPremium
                  ? ['rgba(255,255,255,0.3)', 'transparent']
                  : ['rgba(255,220,228,0.22)', 'transparent']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.vipContent}>
              <View style={styles.vipTextCol}>
                <View
                  style={[
                    styles.vipBadgeRow,
                    isPremium && { backgroundColor: 'rgba(255,255,255,0.25)' },
                  ]}
                >
                  <Icon
                    name="diamond"
                    size={12}
                    color={isPremium ? '#FFF' : '#FBBF24'}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.vipBadgeText,
                      isPremium && { color: '#FFF' },
                    ]}
                  >
                    {isPremium
                      ? `${planName.toUpperCase()} ACTIVE`
                      : 'PREMIUM MEMBER'}
                  </Text>
                </View>
                <Text style={[styles.vipTitle, isPremium && { color: '#FFF' }]}>
                  {isPremium
                    ? `You are a ${planName} Member`
                    : 'Make room for more connections'}
                </Text>
                <Text
                  style={[
                    styles.vipDesc,
                    isPremium && { color: 'rgba(255,255,255,0.9)' },
                  ]}
                >
                  {isPremium
                    ? 'Your premium benefits are currently active.'
                    : 'Explore membership options for your next chapter.'}
                </Text>
              </View>
              {!isPremium && (
                <View style={styles.vipIconCircle}>
                  <Icon name="arrow-forward" size={20} color="#18181B" />
                </View>
              )}
            </View>
          </AnimatedButton>

          {/* Daily Plan Allowance & Quota Card */}
          <View style={styles.allowanceCard}>
            <View style={styles.allowanceHeader}>
              <View style={styles.allowanceTitleRow}>
                <View style={styles.allowanceIconWrap}>
                  <Icon
                    name="speedometer-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.allowanceCopy}>
                  <Text style={styles.allowanceTitle}>
                    Today's Plan Allowance
                  </Text>
                  <Text style={styles.allowanceSubtitle}>
                    Daily quotas reset at 12:00 AM
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.planBadgeSmall,
                  { backgroundColor: planConfig.accentColor + '18' },
                ]}
              >
                <Text
                  style={[
                    styles.planBadgeSmallText,
                    { color: planConfig.accentColor },
                  ]}
                >
                  {planConfig.badge}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.allowanceMetersRow,
                stackCards && styles.stackedRow,
              ]}
            >
              {/* Daily Interests */}
              <View style={styles.allowanceMeterBox}>
                <View style={styles.meterHeader}>
                  <View
                    style={[
                      styles.meterIconCircle,
                      { backgroundColor: '#FFE4E6' },
                    ]}
                  >
                    <Icon name="heart" size={13} color="#A53760" />
                  </View>
                  <Text style={styles.meterLabel}>Daily Interests</Text>
                </View>
                <View style={styles.meterValueRow}>
                  <Text style={styles.meterValueMain}>
                    {allowance.isInterestsUnlimited
                      ? 'Unlimited'
                      : allowance.interestsRemaining}
                  </Text>
                  {!allowance.isInterestsUnlimited && (
                    <Text style={styles.meterValueSub}>
                      of {allowance.interestsLimit} left
                    </Text>
                  )}
                </View>
                <Text style={styles.meterUsedText}>
                  {allowance.isInterestsUnlimited
                    ? `${allowance.interestsUsed} sent today`
                    : `${allowance.interestsUsed} of ${allowance.interestsLimit} sent today`}
                </Text>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: '#A53760',
                        width: allowance.isInterestsUnlimited
                          ? '100%'
                          : `${Math.max(8, 100 - allowance.interestsPercent)}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Daily Profile Views */}
              <View style={styles.allowanceMeterBox}>
                <View style={styles.meterHeader}>
                  <View
                    style={[
                      styles.meterIconCircle,
                      { backgroundColor: '#EEF2FF' },
                    ]}
                  >
                    <Icon name="eye" size={13} color="#6366F1" />
                  </View>
                  <Text style={styles.meterLabel}>Profile Views</Text>
                </View>
                <View style={styles.meterValueRow}>
                  <Text style={styles.meterValueMain}>
                    {allowance.isViewsUnlimited
                      ? 'Unlimited'
                      : allowance.viewsRemaining}
                  </Text>
                  {!allowance.isViewsUnlimited && (
                    <Text style={styles.meterValueSub}>
                      of {allowance.viewsLimit} left
                    </Text>
                  )}
                </View>
                <Text style={styles.meterUsedText}>
                  {allowance.isViewsUnlimited
                    ? `${allowance.viewsUsed} viewed today`
                    : `${allowance.viewsUsed} of ${allowance.viewsLimit} viewed today`}
                </Text>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        backgroundColor: '#6366F1',
                        width: allowance.isViewsUnlimited
                          ? '100%'
                          : `${Math.max(8, 100 - allowance.viewsPercent)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>

            {/* Contact Unlocks + Upgrade Row */}
            <View style={styles.allowanceFooter}>
              <View style={styles.allowanceFooterLeft}>
                <Icon
                  name="call-outline"
                  size={14}
                  color={colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.allowanceFooterText}>
                  Direct Contacts:{' '}
                  <Text style={styles.allowanceFooterBold}>
                    {allowance.contactUnlocksRemaining} left
                  </Text>
                </Text>
              </View>
              <TouchableOpacity
                style={styles.allowanceUpgradeBtn}
                onPress={() => handleToolPress('Membership')}
                activeOpacity={0.8}
              >
                <Text style={styles.allowanceUpgradeBtnText}>
                  {isPremium ? 'Change Plan' : 'Upgrade Plan'}
                </Text>
                <Icon name="chevron-forward" size={12} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Stats Grid */}
          <View style={[styles.statsRow, stackCards && styles.stackedRow]}>
            {/* Interests Received */}
            <AnimatedButton
              style={styles.statCard}
              onPress={() => navigation.navigate('Interests')}
            >
              <LinearGradient
                colors={['#FDF4FF', '#FAE8FF']}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[styles.statIconWrapper, { backgroundColor: '#F5D0FE' }]}
              >
                <Icon name="mail-unread" size={20} color="#C026D3" />
              </View>
              <Text style={[styles.statValue, { color: '#86198F' }]}>
                {receivedInterests.length}
              </Text>
              <Text style={styles.statLabel}>Interests{'\n'}Received</Text>
            </AnimatedButton>

            {/* Interests Sent */}
            <AnimatedButton
              style={styles.statCard}
              onPress={() => navigation.navigate('Interests')}
            >
              <LinearGradient
                colors={['#F0FDF4', '#DCFCE7']}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[styles.statIconWrapper, { backgroundColor: '#BBF7D0' }]}
              >
                <Icon name="paper-plane" size={20} color="#16A34A" />
              </View>
              <Text style={[styles.statValue, { color: '#166534' }]}>
                {sentInterests.length}
              </Text>
              <Text style={styles.statLabel}>Interests{'\n'}Sent</Text>
            </AnimatedButton>
          </View>

          <View style={[styles.statsRow, stackCards && styles.stackedRow]}>
            {/* Mutual Matches */}
            <AnimatedButton
              style={styles.statCard}
              onPress={() => navigation.navigate('Chats')}
            >
              <LinearGradient
                colors={['#FFF1F2', '#FFE4E6']}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[styles.statIconWrapper, { backgroundColor: '#FECDD3' }]}
              >
                <Icon name="heart" size={20} color="#A53760" />
              </View>
              <Text style={[styles.statValue, { color: '#9F1239' }]}>
                {chats.length}
              </Text>
              <Text style={styles.statLabel}>Mutual{'\n'}Matches</Text>
            </AnimatedButton>

            {/* Profile Visitors */}
            <AnimatedButton
              style={styles.statCard}
              onPress={() => handleToolPress('Visitors')}
            >
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7']}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[styles.statIconWrapper, { backgroundColor: '#FDE68A' }]}
              >
                <Icon name="eye" size={20} color="#D97706" />
              </View>
              <Text style={[styles.statValue, { color: '#92400E' }]}>12</Text>
              <Text style={styles.statLabel}>Profile{'\n'}Visitors</Text>
            </AnimatedButton>
          </View>

          {/* Sleek Activity Widget */}
          <AnimatedButton
            style={styles.sleekActivityWidget}
            onPress={() => navigation.navigate('Interests' as any)}
          >
            <View style={styles.activityHeader}>
              <Text style={styles.activityTitle}>Recent Activity</Text>
              <Icon
                name="arrow-forward"
                size={16}
                color={colors.textTertiary}
              />
            </View>
            {recentProfile ? (
              <View style={styles.activityBody}>
                <AuthImage
                  source={{ uri: recentProfile.photo }}
                  style={styles.activityAvatarSmall}
                />
                <View style={styles.activityTextCol}>
                  <Text style={styles.activityNameText}>
                    {recentProfile.name}
                  </Text>
                  <Text style={styles.activityActionText}>
                    Viewed your profile
                  </Text>
                </View>
                <View style={styles.activityTimeBadge}>
                  <Text style={styles.activityTimeText}>2m ago</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyActivity}>No recent activity yet.</Text>
            )}
          </AnimatedButton>

          {/* List Style Utilities */}
          <View style={styles.utilitiesList}>
            <Text style={styles.utilitiesHeader}>Account Options</Text>

            <AnimatedButton
              style={styles.utilListItem}
              onPress={() => handleToolPress('Compare')}
            >
              <View
                style={[styles.utilIconBox, { backgroundColor: '#F3F4F6' }]}
              >
                <Icon name="git-compare" size={18} color="#4B5563" />
              </View>
              <Text style={styles.utilListText}>Compare Profiles</Text>
              <Icon name="chevron-forward" size={18} color="#D1D5DB" />
            </AnimatedButton>

            <AnimatedButton
              style={styles.utilListItem}
              onPress={() => handleToolPress('Verification')}
            >
              <View
                style={[styles.utilIconBox, { backgroundColor: '#EFF6FF' }]}
              >
                <Icon name="shield-checkmark" size={18} color="#3B82F6" />
              </View>
              <Text style={styles.utilListText}>Trust & Verification</Text>
              <Icon name="chevron-forward" size={18} color="#D1D5DB" />
            </AnimatedButton>

            <AnimatedButton
              style={[styles.utilListItem, { borderBottomWidth: 0 }]}
              onPress={logout}
            >
              <View
                style={[styles.utilIconBox, { backgroundColor: '#FEF2F2' }]}
              >
                <Icon name="log-out" size={18} color="#EF4444" />
              </View>
              <Text style={[styles.utilListText, { color: '#EF4444' }]}>
                Logout
              </Text>
              <Icon name="chevron-forward" size={18} color="#D1D5DB" />
            </AnimatedButton>
          </View>
        </View>
      </Animated.ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.background },

  // Hero Parallax
  heroBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  heroBackgroundImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  // Top Nav (Glassmorphism)
  topNav: {
    flexShrink: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    zIndex: 10,
  },
  navTitle: {
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#302330',
    letterSpacing: -0.6,
  },
  navActions: {
    flexDirection: 'row',
    gap: 10,
  },
  navBtnGlass: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  navBtnGlassSmall: {
    width: 44,
    height: 44,
    borderRadius: 17,
  },
  notificationDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },

  // Profile Info
  profileInfoSection: {
    alignItems: 'center',
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarMain: {
    width: 96,
    height: 96,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#FFE1EC',
  },
  avatarMainGold: {
    borderColor: '#FBBF24',
  },
  premiumBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    overflow: 'hidden',
  },
  verifiedPulse: {
    position: 'absolute',
    bottom: -4,
    right: -5,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadgeInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  profileName: {
    textAlign: 'center',
    flexShrink: 1,
    ...typeScale.title,
    fontSize: 26,
    marginBottom: 2,
  },
  profileSub: {
    ...typeScale.body,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: colors.surfaceTint,
  },
  editBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },

  // Grid
  contentGrid: {
    paddingHorizontal: 20,
    paddingTop: 18,
    gap: 16,
  },

  // VIP Banner
  vipBanner: {
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    ...shadow.md,
  },
  vipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  vipTextCol: {
    flex: 1,
  },
  vipBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251,191,36,0.15)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    marginBottom: 8,
  },
  vipBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  vipTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  vipDesc: {
    color: '#E3D6E1',
    fontSize: 13,
  },
  vipIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBBF24',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats Grid
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
    ...shadow.sm,
    borderWidth: 0,
  },
  statIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    lineHeight: 16,
  },

  // Sleek Activity
  sleekActivityWidget: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    ...shadow.sm,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  activityBody: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAvatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  activityTextCol: {
    flex: 1,
  },
  activityNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  activityActionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  activityTimeBadge: {
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  activityTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  emptyActivity: {
    fontSize: 14,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

  // Utilities List
  utilitiesList: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    ...shadow.sm,
    marginTop: 8,
  },
  utilitiesHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  utilListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  utilIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  utilListText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  // Daily Allowance Card
  allowanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.sm,
  },
  stackedRow: { flexDirection: 'column' },
  allowanceCopy: { flex: 1, minWidth: 0 },
  allowanceHeader: {
    flexWrap: 'wrap',
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  allowanceTitleRow: {
    flexGrow: 1,
    flexBasis: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  allowanceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allowanceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  allowanceSubtitle: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
    marginTop: 1,
  },
  planBadgeSmall: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  planBadgeSmallText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  allowanceMetersRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  allowanceMeterBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  meterIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterLabel: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  meterValueRow: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 2,
  },
  meterValueMain: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
  },
  meterValueSub: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  meterUsedText: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '500',
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  allowanceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  allowanceFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allowanceFooterText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  allowanceFooterBold: {
    fontWeight: '700',
    color: colors.text,
  },
  allowanceUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  allowanceUpgradeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // Hero section tags and actions
  heroTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  heroTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(165,55,96,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(165,55,96,0.15)',
  },
  heroTagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A274E',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  heroPreviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
    ...shadow.sm,
  },
  heroPreviewBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  heroEditBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  heroEditBtnText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
  },

});
