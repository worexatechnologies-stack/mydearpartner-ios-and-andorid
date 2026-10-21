import ScreenContainer from '../../components/ScreenContainer';
import { useAuth } from '../../context/AuthContext';
import { sameProfileCity } from '../../utils/profileLocation';
import { useProfilePager } from '../../hooks/useProfilePager';
import { colors } from '../../theme/theme';
import {
  BottomTabScreenProps,
  useBottomTabBarHeight,
} from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  Image,
  Alert,
  Platform,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Heart,
  Bell,
  SlidersHorizontal,
  Search,
  ShieldCheck,
  Star,
  Compass,
  X,
} from 'lucide-react-native';
import AnimatedButton from '../../components/AnimatedButton';

import { useAppData } from '../../context/AppDataContext';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { usePlanAllowance } from '../../utils/planAllowance';
import { isInterestQuotaError } from '../../utils/interestErrors';
import AuthImage from '../../components/AuthImage';
import ProfileCardSkeleton from '../../components/ProfileCardSkeleton';
import MatchCelebrationModal from '../../components/MatchCelebrationModal';
import { triggerHaptic } from '../../utils/haptics';
import { Profile } from '../../types/models';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';
import analyticsService, { getCountBand } from '../../services/analyticsService';
import {
  calculateGeminiHoroscopeMatch,
  GeminiHoroscopeAnalysis,
} from '../../services/geminiHoroscopeService';
import GeminiHoroscopeModal from '../../components/GeminiHoroscopeModal';
import CompatibilityBreakdownModal from '../../components/CompatibilityBreakdownModal';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Discover'>,
  NativeStackScreenProps<RootStackParamList>
>;

export default function DiscoverScreen({ navigation }: Props) {
  const { currentUser } = useAuth();
  const allowance = usePlanAllowance();
  const { refreshUsage } = allowance;

  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const {
    pageHeight,
    pagingEnabled,
    onLayout: measureViewport,
  } = useProfilePager();

  useFocusEffect(
    useCallback(() => {
      refreshUsage();
    }, [refreshUsage]),
  );

  const {
    discoverProfiles,
    isLoadingProfiles,
    profilesError,
    refreshDiscoverProfiles,
    sendInterest,
    toggleShortlist,
    isShortlisted,
    getInterestRelationship,
    receivedInterests,
    totalUnreadCount,
  } = useAppData();

  const pendingInterestsCount = receivedInterests.filter(
    i => i.status === 'pending',
  ).length;
  const totalNotifications = totalUnreadCount + pendingInterestsCount;

  const [activeFilter, setActiveFilter] = useState<
    'Discover' | 'Vedic' | 'Matches' | 'NearYou' | 'Online'
  >('Discover');
  const [celebration, setCelebration] = useState<{
    visible: boolean;
    name: string;
    avatarUrl?: string | null;
  }>({ visible: false, name: '' });
  const [horoscopeTarget, setHoroscopeTarget] = useState<{
    profile: Profile;
    analysis: GeminiHoroscopeAnalysis;
  } | null>(null);
  const [hiddenProfileIds, setHiddenProfileIds] = useState<Set<string>>(
    new Set(),
  );
  const [compatTarget, setCompatTarget] = useState<Profile | null>(null);


  const handleSkip = useCallback((profileId: string) => {
    setHiddenProfileIds(prev => {
      const next = new Set(prev);
      next.add(profileId);
      return next;
    });
  }, []);

  const visibleProfiles = discoverProfiles.filter(
    p => !hiddenProfileIds.has(p.id),
  );

  // Apply tab filters and exclude connected friends
  const filteredProfiles = visibleProfiles.filter(p => {
    // 1. Completely hide people we are already connected/interacted with
    const rel = getInterestRelationship(p.id);
    if (rel.status !== 'none') return false;

    // 2. Tab filters
    if (activeFilter === 'Vedic') {
      return Boolean(p.starNakshatra?.trim());
    }
    if (activeFilter === 'Matches') return (p.compatibilityScore || 0) >= 70;
    if (activeFilter === 'NearYou')
      return sameProfileCity(currentUser?.profile?.city, p.city);
    if (activeFilter === 'Online') return !!p.isOnline;
    return true; // 'Discover'
  });

  // Preload next profile images for high frame-rate scrolling
  useEffect(() => {
    if (filteredProfiles.length > 0) {
      const urlsToPreload = filteredProfiles
        .slice(0, 6)
        .map(p => p.photo || p.photos?.[0])
        .filter((url): url is string => Boolean(url && url.startsWith('http')));
      if (urlsToPreload.length > 0 && typeof FastImage?.preload === 'function') {
        try {
          FastImage.preload(
            urlsToPreload.map(uri => ({
              uri,
              priority: FastImage.priority?.high ?? 'high',
            })),
          );
        } catch {
          // Native image preloader unavailable in test environment
        }
      }
    }
  }, [filteredProfiles]);

  // Track recommendation_view according to Slide 21 specifications
  useEffect(() => {
    if (!isLoadingProfiles) {
      analyticsService
        .trackRecommendationView({
          cohort: currentUser?.profile?.city || 'unknown',
          count_band: getCountBand(filteredProfiles.length),
          response_latency: '<200ms',
        })
        .catch(() => {});
    }
  }, [
    isLoadingProfiles,
    activeFilter,
    filteredProfiles.length,
    currentUser?.profile?.city,
  ]);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.headerRow}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={{ width: 38, height: 34 }}
            resizeMode="contain"
          />
          <View style={styles.logoTextContainer}>
            <Text style={styles.logoText}>
              MyDear<Text style={styles.logoTextHighlight}>Partner</Text>
            </Text>
            <Text style={styles.logoSubText}>
              TRUSTED MATCHMAKING
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButtonCircle}
            accessibilityRole="button"
            accessibilityLabel="Search profiles"
            onPress={() => navigation.navigate('Search')}
          >
            <Search size={20} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButtonCircle}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => navigation.navigate('Notifications')}
          >
            <Bell size={20} color="#333" />
            {totalNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationText}>
                  {totalNotifications > 99 ? '99+' : totalNotifications}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterTabsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
        >
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'Discover' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('Discover')}
          >
            <Text
              style={
                activeFilter === 'Discover'
                  ? styles.filterTabTextActive
                  : styles.filterTabText
              }
            >
              For You
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'Vedic' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('Vedic')}
          >
            <Text
              style={
                activeFilter === 'Vedic'
                  ? styles.filterTabTextActive
                  : styles.filterTabText
              }
            >
              🪐 Horoscope listed
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'Matches' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('Matches')}
          >
            <Text
              style={
                activeFilter === 'Matches'
                  ? styles.filterTabTextActive
                  : styles.filterTabText
              }
            >
              New Matches
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterTab,
              activeFilter === 'NearYou' && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter('NearYou')}
          >
            <Text
              style={
                activeFilter === 'NearYou'
                  ? styles.filterTabTextActive
                  : styles.filterTabText
              }
            >
              Nearby
            </Text>
          </TouchableOpacity>
        </ScrollView>
        <TouchableOpacity
          style={styles.filterIconBtn}
          accessibilityRole="button"
          accessibilityLabel="Filter profiles"
          onPress={() => navigation.navigate('Search', { openFilters: true })}
        >
          <SlidersHorizontal size={18} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (profilesError && !isLoadingProfiles)
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{profilesError}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            style={styles.refreshBtn}
            onPress={() => refreshDiscoverProfiles()}
          >
            <Text style={styles.refreshBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    if (isLoadingProfiles) {
      return (
        <View style={[styles.emptyContainer, { justifyContent: 'flex-start', paddingTop: 8 }]}>
          <ProfileCardSkeleton />
        </View>
      );
    }
    return (
      <View style={styles.emptyCardContainer}>
        <View style={styles.emptyIconCircle}>
          <Compass size={28} color={colors.action} />
        </View>
        <Text style={styles.emptyTitle}>Expanding in your region</Text>
        <Text style={styles.emptyDescription}>
          We are actively onboarding verified profiles in your area. As new members matching your preferences join, they will appear here daily.
        </Text>
        <View style={styles.emptyTipBox}>
          <Text style={styles.emptyTipText}>
            💡 Thoughtful matchmaking uses information members choose to provide. Broadening your filters or completing your profile helps unlock more recommendations.
          </Text>
        </View>

        <View style={styles.emptyActionRow}>
          <TouchableOpacity
            style={styles.emptyPrimaryBtn}
            onPress={() => navigation.navigate('Search', { openFilters: true })}
            accessibilityRole="button"
          >
            <SlidersHorizontal size={15} color="#FFF" />
            <Text style={styles.emptyPrimaryBtnText}>Adjust Filters</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.emptySecondaryBtn}
            onPress={() => refreshDiscoverProfiles()}
            accessibilityRole="button"
          >
            <Text style={styles.emptySecondaryBtnText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const handleSendInterestAction = useCallback(
    async (item: Profile) => {
      triggerHaptic('success');
      try {
        await sendInterest(item.id, item.userId);
        setCelebration({
          visible: true,
          name: item.name || 'your match',
          avatarUrl: item.photo || item.photos?.[0],
        });
      } catch (err: any) {
        if (isInterestQuotaError(err)) {
          Alert.alert(
            'Daily Interest Limit Reached',
            err?.message ||
              'You have reached your daily interest limit. Upgrade your plan to send more interests!',
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
    },
    [sendInterest, navigation],
  );

  const handleOpenHoroscope = useCallback(
    (profile: Profile, analysis: GeminiHoroscopeAnalysis) => {
      setHoroscopeTarget({ profile, analysis });
    },
    [],
  );

  const renderProfileItem = useCallback(
    ({ item }: { item: Profile }) => (
      <View style={[styles.profilePage, { height: pageHeight }]}>
        <ProfileFeedCard
          profile={item}
          myProfile={currentUser?.profile}
          navigation={navigation}
          onSendInterest={() => handleSendInterestAction(item)}
          onSkip={() => {
            triggerHaptic('light');
            handleSkip(item.id);
          }}
          isShortlisted={isShortlisted(item.id)}
          onToggleShortlist={() => {
            triggerHaptic('medium');
            toggleShortlist(item.id);
          }}
          onOpenHoroscope={handleOpenHoroscope}
        />
        <View style={styles.scrollHint}>
          <Text style={styles.scrollHintText}>
            ↔ Swipe right to Connect, left to Pass ↓
          </Text>
        </View>
      </View>
    ),
    [
      pageHeight,
      currentUser?.profile,
      navigation,
      handleSendInterestAction,
      handleSkip,
      isShortlisted,
      toggleShortlist,
      handleOpenHoroscope,
    ],
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <ScreenContainer edges={['top', 'left', 'right']}>
        {renderHeader()}




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
          <FlatList
            key={`${activeFilter}-${pageHeight}`}
            style={styles.feedList}
            data={filteredProfiles}
            keyExtractor={item => item.id}
            ListEmptyComponent={renderEmpty}
            pagingEnabled={pagingEnabled}
            snapToInterval={pageHeight || undefined}
            decelerationRate="fast"
            disableIntervalMomentum
            getItemLayout={
              pageHeight > 0
                ? (_, index) => ({
                    length: pageHeight,
                    offset: pageHeight * index,
                    index,
                  })
                : undefined
            }
            contentContainerStyle={styles.feedContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={2}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            updateCellsBatchingPeriod={50}
            renderItem={renderProfileItem}
          />
        </View>
      </ScreenContainer>
      <MatchCelebrationModal
        visible={celebration.visible}
        profileName={celebration.name}
        avatarUrl={celebration.avatarUrl}
        onClose={() => setCelebration({ visible: false, name: '' })}
      />
      {horoscopeTarget && (
        <GeminiHoroscopeModal
          visible={!!horoscopeTarget}
          onClose={() => setHoroscopeTarget(null)}
          analysis={horoscopeTarget.analysis}
          myProfile={currentUser?.profile}
          theirProfile={horoscopeTarget.profile}
        />
      )}
      {compatTarget && (
        <CompatibilityBreakdownModal
          visible={!!compatTarget}
          onClose={() => setCompatTarget(null)}
          myProfile={currentUser?.profile}
          theirProfile={compatTarget}
        />
      )}
    </GestureHandlerRootView>
  );
}

const ProfileFeedCard = React.memo(({
  profile,
  myProfile,
  navigation,
  onSendInterest,
  onSkip,
  isShortlisted,
  onToggleShortlist,
  onOpenHoroscope,
}: {
  profile: Profile;
  myProfile?: Profile | null;
  navigation: any;
  onSendInterest: () => void;
  onSkip: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
  onOpenHoroscope?: (profile: Profile, analysis: GeminiHoroscopeAnalysis) => void;
}) => {
  const translateX = useSharedValue(0);
  const cardOpacity = useSharedValue(1);

  useEffect(() => {
    translateX.value = 0;
    cardOpacity.value = 1;
  }, [profile.id, translateX, cardOpacity]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-20, 20])
    .onUpdate(event => {
      translateX.value = event.translationX;
    })
    .onEnd(event => {
      if (event.translationX > 110) {
        translateX.value = withTiming(500, { duration: 220 }, () => {
          runOnJS(triggerHaptic)('success');
          runOnJS(onSendInterest)();
        });
        cardOpacity.value = withTiming(0, { duration: 220 });
      } else if (event.translationX < -110) {
        translateX.value = withTiming(-500, { duration: 220 }, () => {
          runOnJS(triggerHaptic)('light');
          runOnJS(onSkip)();
        });
        cardOpacity.value = withTiming(0, { duration: 220 });
      } else {
        translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-300, 0, 300],
      [-14, 0, 14],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
      ],
      opacity: cardOpacity.value,
    };
  });

  const likeStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [25, 95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [25, 95],
      [0.85, 1.05],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ scale }, { rotate: '-12deg' }],
    };
  });

  const passStampStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      translateX.value,
      [-25, -95],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      translateX.value,
      [-25, -95],
      [0.85, 1.05],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ scale }, { rotate: '12deg' }],
    };
  });

  const horoscope = React.useMemo(() => {
    return calculateGeminiHoroscopeMatch(myProfile, profile);
  }, [myProfile, profile]);

  // Format location string safely without dangling commas
  const locationParts = [profile.city, profile.state].filter(Boolean);
  const locationString = locationParts.join(', ');

  // Format community string safely
  const communityParts = [profile.religion, profile.caste].filter(Boolean);
  const communityString = communityParts.join(', ');

  // Create chips array for dynamic rendering, filtering out empty values
  const chips = [
    communityString,
    profile.motherTongue,
    locationString,
    profile.education,
    profile.profession,
    profile.maritalStatus,
  ].filter(Boolean) as string[];

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.cardContainer, animatedCardStyle]}>
        <TouchableOpacity
          activeOpacity={0.98}
          style={styles.cardTouchWrapper}
          onPress={() =>
            navigation.navigate('ProfileDetail', { profileId: profile.id })
          }
        >
          {/* Stamps */}
          <Animated.View style={[styles.stampLike, likeStampStyle]} pointerEvents="none">
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.stampGradient}
            >
              <Heart size={18} color="#FFF" fill="#FFF" />
              <Text style={styles.stampText}>CONNECT</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[styles.stampPass, passStampStyle]} pointerEvents="none">
            <LinearGradient
              colors={['#EF4444', '#DC2626']}
              style={styles.stampGradient}
            >
              <X size={18} color="#FFF" />
              <Text style={styles.stampText}>PASS</Text>
            </LinearGradient>
          </Animated.View>

          <View style={styles.imageContainer}>
            <AuthImage
              source={{ uri: profile.photo }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['rgba(0,0,0,0.0)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />

            <View style={styles.badgesRow}>
              {profile.isVerified !== false && (
                <View style={styles.badgeVerified}>
                  <ShieldCheck size={14} color="#FFF" />
                  <Text style={styles.badgeText}>Verified</Text>
                </View>
              )}
              {profile.isPremium && (
                <View style={styles.badgePremium}>
                  <Star size={12} color="#FFF" fill="#FFF" />
                  <Text style={styles.badgeText}>Premium</Text>
                </View>
              )}
              {/* Kundali Gunas Badge */}
              <TouchableOpacity
                style={styles.badgeKundali}
                activeOpacity={0.8}
                onPress={e => {
                  e.stopPropagation?.();
                  triggerHaptic('light');
                  onOpenHoroscope?.(profile, horoscope);
                }}
              >
                <Icon name="planet" size={12} color="#FDE68A" style={{ marginRight: 3 }} />
                <Text style={styles.badgeKundaliText}>
                  Profile insights
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.imageInfoContent}>
              <View style={styles.nameRow}>
                <Text style={styles.nameText} numberOfLines={1}>
                  {profile.name}
                </Text>
                {profile.isOnline && <View style={styles.onlineDot} />}
              </View>
              <Text style={styles.basicSubText}>
                {profile.age} yrs{profile.height ? ` • ${profile.height}` : ''}
                {profile.compatibilityScore
                  ? `  |  ${profile.compatibilityScore}% Match`
                  : ''}
              </Text>
            </View>
          </View>

          <View style={styles.cardBody}>
            {/* Chips Section */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsContainer}
              style={styles.chipsScroll}
            >
              {chips.map((chip, index) => (
                <View key={index} style={styles.chip}>
                  <Text style={styles.chipText}>{chip}</Text>
                </View>
              ))}
            </ScrollView>

            {/* Bio Section */}
            {profile.about ? (
              <Text style={styles.bioText} numberOfLines={1}>
                {profile.about}
              </Text>
            ) : null}

            <View style={styles.divider} />

            {/* Action Buttons Section */}
            <View style={styles.actionsContainer}>
              <AnimatedButton
                style={styles.actionBtnIconOnly}
                accessibilityRole="button"
                accessibilityLabel="Skip profile"
                activeScale={0.88}
                onPress={onSkip}
              >
                <X size={24} color="#5F6368" />
              </AnimatedButton>

              <View style={styles.primaryActionsRow}>
                <AnimatedButton
                  style={[
                    styles.actionBtnTonal,
                    isShortlisted && { backgroundColor: colors.action },
                  ]}
                  activeScale={0.93}
                  onPress={onToggleShortlist}
                >
                  <Star
                    size={20}
                    color={isShortlisted ? '#FFF' : colors.action}
                    fill={isShortlisted ? '#FFF' : 'transparent'}
                  />
                  <Text
                    style={[
                      styles.actionBtnTonalText,
                      isShortlisted && { color: '#FFF' },
                    ]}
                  >
                    {isShortlisted ? 'Shortlisted' : 'Shortlist'}
                  </Text>
                </AnimatedButton>

                <AnimatedButton
                  style={styles.actionBtnSolid}
                  activeScale={0.93}
                  onPress={onSendInterest}
                >
                  <Heart size={20} color="#FFF" fill="#FFF" />
                  <Text style={styles.actionBtnSolidText}>Connect</Text>
                </AnimatedButton>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  feedViewport: { flex: 1, minHeight: 0 },
  feedList: { flex: 1 },
  feedContent: { flexGrow: 1 },
  profilePage: { paddingTop: 4, paddingHorizontal: 16, alignItems: 'center' },
  scrollHint: { height: 28, justifyContent: 'center' },
  scrollHintText: { fontSize: 11, color: '#8B7380', fontWeight: '500' },
  chipsScroll: { flexGrow: 0, marginBottom: 10 },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerContainer: {
    backgroundColor: colors.background,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  logoTextContainer: {
    flexShrink: 1,
    minWidth: 0,
    marginLeft: 8,
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#1F2937',
    letterSpacing: -0.5,
  },
  logoTextHighlight: {
    color: colors.action,
  },
  logoSubText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#6B7280',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  notificationText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: '800',
  },
  filterTabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#E5E7EB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: '#FDF2F8',
    borderColor: '#FBCFE8',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterTabTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.action,
  },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 20,
  },
  refreshBtn: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  refreshBtnText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    marginHorizontal: 16,
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(217,119,6,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  emptyTipBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    width: '100%',
  },
  emptyTipText: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
    textAlign: 'center',
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    justifyContent: 'center',
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.action,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 100,
  },
  emptyPrimaryBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  emptySecondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 100,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptySecondaryBtnText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },

  /* Material Design 3 Card Styling */
  cardContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    overflow: 'hidden',
    // M3 subtle elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  cardTouchWrapper: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  stampLike: {
    position: 'absolute',
    top: 32,
    left: 20,
    zIndex: 999,
  },
  stampPass: {
    position: 'absolute',
    top: 32,
    right: 20,
    zIndex: 999,
  },
  stampGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  stampText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  imageContainer: {
    flex: 1,
    minHeight: 100,
    width: '100%',
    position: 'relative',
    backgroundColor: '#E5E7EB',
  },
  badgesRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeVerified: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981', // M3 emerald
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  badgePremium: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  badgeKundali: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(120, 53, 15, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  badgeKundaliText: {
    color: '#FEF3C7',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  imageInfoContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingTop: 40, // For smooth gradient fade
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
    marginLeft: 10,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  basicSubText: {
    color: '#F3F4F6',
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  cardBody: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  chipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '500',
  },
  bioText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
    marginHorizontal: -14,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  primaryActionsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 8,
    justifyContent: 'flex-end',
  },
  actionBtnIconOnly: {
    width: 48,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnTonal: {
    minHeight: 48,
    flex: 1,
    paddingHorizontal: 8,
    borderRadius: 24,
    backgroundColor: '#FDF2F8',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnTonalText: {
    flexShrink: 1,
    textAlign: 'center',
    color: colors.action,
    fontSize: 13,
    fontWeight: '700',
  },
  actionBtnSolid: {
    flex: 1,
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.action,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  actionBtnSolidText: {
    flexShrink: 1,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
