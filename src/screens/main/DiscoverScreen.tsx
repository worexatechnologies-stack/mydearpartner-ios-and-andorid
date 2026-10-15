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
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  Heart,
  Bell,
  SlidersHorizontal,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react-native';

import { useAppData } from '../../context/AppDataContext';
import { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { usePlanAllowance } from '../../utils/planAllowance';
import AuthImage from '../../components/AuthImage';
import ProfileCardSkeleton from '../../components/ProfileCardSkeleton';
import MatchCelebrationModal from '../../components/MatchCelebrationModal';
import { triggerHaptic } from '../../utils/haptics';
import { Profile } from '../../types/models';
import { FLOATING_TAB_BAR_BOTTOM } from '../../navigation/tabBarLayout';

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
    'Discover' | 'Matches' | 'NearYou' | 'Online'
  >('Discover');
  const [celebration, setCelebration] = useState<{
    visible: boolean;
    name: string;
    avatarUrl?: string | null;
  }>({ visible: false, name: '' });
  const [hiddenProfileIds, setHiddenProfileIds] = useState<Set<string>>(
    new Set(),
  );

  const handleSkip = (profileId: string) => {
    setHiddenProfileIds(prev => {
      const next = new Set(prev);
      next.add(profileId);
      return next;
    });
  };

  const visibleProfiles = discoverProfiles.filter(
    p => !hiddenProfileIds.has(p.id),
  );

  // Apply tab filters and exclude connected friends
  const filteredProfiles = visibleProfiles.filter(p => {
    // 1. Completely hide people we are already connected/interacted with
    const rel = getInterestRelationship(p.id);
    if (rel.status !== 'none') return false;

    // 2. Tab filters
    if (activeFilter === 'Matches') return (p.compatibilityScore || 0) >= 70;
    if (activeFilter === 'NearYou')
      return sameProfileCity(currentUser?.profile?.city, p.city);
    if (activeFilter === 'Online') return !!p.isOnline;
    return true; // 'Discover'
  });

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
              MATRIMONY FOR A BETTER TOMORROW
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
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>You've seen all recommendations!</Text>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={() => refreshDiscoverProfiles()}
        >
          <Text style={styles.refreshBtnText}>Load More</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
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
            renderItem={({ item }) => (
              <View style={[styles.profilePage, { height: pageHeight }]}>
                <ProfileFeedCard
                  profile={item}
                  navigation={navigation}
                  onSendInterest={() => {
                    triggerHaptic('success');
                    sendInterest(item.id, item.userId);
                    setCelebration({
                      visible: true,
                      name: item.name || 'your match',
                      avatarUrl: item.photo || item.photos?.[0],
                    });
                  }}
                  onSkip={() => {
                    triggerHaptic('light');
                    handleSkip(item.id);
                  }}
                  isShortlisted={isShortlisted(item.id)}
                  onToggleShortlist={() => {
                    triggerHaptic('medium');
                    toggleShortlist(item.id);
                  }}
                />
                <View style={styles.scrollHint}>
                  <Text style={styles.scrollHintText}>
                    Scroll down for next profile ↓
                  </Text>
                </View>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
      <MatchCelebrationModal
        visible={celebration.visible}
        profileName={celebration.name}
        avatarUrl={celebration.avatarUrl}
        onClose={() => setCelebration({ visible: false, name: '' })}
      />
    </View>
  );
}

const ProfileFeedCard = ({
  profile,
  navigation,
  onSendInterest,
  onSkip,
  isShortlisted,
  onToggleShortlist,
}: {
  profile: Profile;
  navigation: any;
  onSendInterest: () => void;
  onSkip: () => void;
  isShortlisted: boolean;
  onToggleShortlist: () => void;
}) => {
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
    <TouchableOpacity
      activeOpacity={0.98}
      style={styles.cardContainer}
      onPress={() =>
        navigation.navigate('ProfileDetail', { profileId: profile.id })
      }
    >
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
          <TouchableOpacity
            style={styles.actionBtnIconOnly}
            accessibilityRole="button"
            accessibilityLabel="Skip profile"
            onPress={onSkip}
          >
            <X size={24} color="#5F6368" />
          </TouchableOpacity>

          <View style={styles.primaryActionsRow}>
            <TouchableOpacity
              style={[
                styles.actionBtnTonal,
                isShortlisted && { backgroundColor: colors.action },
              ]}
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
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtnSolid}
              onPress={onSendInterest}
            >
              <Heart size={20} color="#FFF" fill="#FFF" />
              <Text style={styles.actionBtnSolidText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

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
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
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
    flexDirection: 'row',
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
