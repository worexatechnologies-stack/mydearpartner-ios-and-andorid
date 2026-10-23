import { profilePhotoLayout } from '../utils/profilePhotoLayout';
import BufferingIndicator from '../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { getProfileById as fetchProfileById } from '../api/profileService';
import AuthImage from '../components/AuthImage';
import AnimatedButton from '../components/AnimatedButton';
import CompatibilityBreakdownModal from '../components/CompatibilityBreakdownModal';
import GeminiHoroscopeModal from '../components/GeminiHoroscopeModal';
import SafetyCenter from '../components/SafetyCenter';
import ScreenContainer from '../components/ScreenContainer';
import { useAppData } from '../context/AppDataContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { calculateGeminiHoroscopeMatch } from '../services/geminiHoroscopeService';
import { colors, radii, shadow, spacing } from '../theme/theme';
import { Profile } from '../types/models';
import { computeCompatibilityScore } from '../utils/compatibility';
import { triggerHaptic } from '../utils/haptics';
import { isInterestQuotaError } from '../utils/interestErrors';
import { usePlanAllowance } from '../utils/planAllowance';
import { sharedMatchReasons } from '../utils/matchReasons';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export default function ProfileDetailScreen({ route, navigation }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [shortlistLoading, setShortlistLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const [layoutWidth, setLayoutWidth] = useState(
    Math.min(640, width - insets.left - insets.right),
  );
  const compactLayout = layoutWidth < 360 || fontScale > 1.2;
  const { profileId } = route.params;
  const {
    getProfileById,
    sendInterest,
    cancelInterest,
    interestStatusFor,
    getInterestRelationship,
    respondToInterest,
    getOrCreateChatWith,
    isBlockedByMe,
    blockUser,
    unblockUser,
    isShortlisted: checkIsShortlistedGlobal,
    toggleShortlist: toggleShortlistGlobal,
  } = useAppData();

  const isShortlisted = checkIsShortlistedGlobal ? checkIsShortlistedGlobal(profileId) : false;

  const cachedProfile = getProfileById(profileId);
  const [profile, setProfile] = useState<Profile | null>(cachedProfile || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(
    !cachedProfile,
  );

  useEffect(() => {
    let isMounted = true;
    if (cachedProfile) {
      setProfile(cachedProfile);
      setIsLoadingProfile(false);
    } else {
      setProfile(null);
      setIsLoadingProfile(true);
    }

    const fetchPromise = fetchProfileById(profileId);
    if (fetchPromise && typeof fetchPromise.then === 'function') {
      fetchPromise
        .then(res => {
          if (isMounted && res?.id && res.name?.trim()) {
            setProfile(res);
          }
          if (isMounted) setIsLoadingProfile(false);
        })
        .catch(() => {
          if (isMounted) {
            setIsLoadingProfile(false);
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [profileId, cachedProfile]);

  const rel = getInterestRelationship(profileId);
  const existingInterest = rel.activeInterest || interestStatusFor(profileId);
  const iBlocked = isBlockedByMe(profileId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [photoSizes, setPhotoSizes] = useState<Record<string, { width: number; height: number }>>({});
  useEffect(() => setActiveIndex(0), [profileId]);
  const [showMenu, setShowMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const headerScrollRef = useRef<any>(null);
  useEffect(() => {
    headerScrollRef.current?.scrollTo({
      x: activeIndex * Math.max(1, layoutWidth - 32),
      animated: false,
    });
  }, [layoutWidth, activeIndex]);
  const [compatModalOpen, setCompatModalOpen] = useState(false);

  const allowance = usePlanAllowance();
  const { recordView } = allowance;
  const { currentUser } = useAuth();
  const myProfile = currentUser?.profile;
  const isSelf = Boolean(
    myProfile &&
    (myProfile.id === profileId ||
      profile?.id === myProfile.id ||
      (profile?.userId && profile.userId === currentUser?.id)),
  );

  const [horoscopeModalOpen, setHoroscopeModalOpen] = useState(false);
  const horoscopeAnalysis = React.useMemo(() => {
    return calculateGeminiHoroscopeMatch(myProfile, profile);
  }, [myProfile, profile]);

  const matchReasons = React.useMemo(() => sharedMatchReasons(myProfile, profile), [profile, myProfile]);

  const isPhotoLocked = Boolean(
    !isSelf &&
    profile &&
    (profile.photoPrivacy === 'accepted_only' ||
      profile.photoPrivacy === 'blurred') &&
    existingInterest?.status !== 'accepted',
  );

  const handleShareBioData = async () => {
    if (!profile) return;
    try {
      triggerHaptic('medium');
      const lines = [
        `💍 *Matrimonial Bio-Data — My Dear Partner* 💍\n`,
        `👤 *Name*: ${profile.name}`,
        `🎂 *Age / Height*: ${profile.age} yrs • ${profile.height || 'N/A'}`,
        `💼 *Profession*: ${profile.profession}${profile.company ? ` at ${profile.company}` : ''}`,
        `🎓 *Education*: ${profile.education || 'N/A'}`,
        `📍 *Location*: ${profile.city}${profile.state ? `, ${profile.state}` : ''}`,
        `🏛️ *Community*: ${profile.religion || 'Not specified'}${profile.caste ? ` (${profile.caste})` : ''}`,
        profile.starNakshatra ? `⭐ *Astro / Nakshatra*: ${profile.starNakshatra}` : '',
        profile.about ? `\n📝 *About*: "${profile.about.slice(0, 150)}..."` : '',
        `\n📲 *View full verified profile on My Dear Partner*:`,
        `https://mydearpartner.in/profile/${profile.id}`,
      ].filter(Boolean);

      await Share.share({
        message: lines.join('\n'),
        title: `${profile.name} — Matrimonial Profile`,
      });
    } catch {
      // dismissed
    }
  };

  useEffect(() => {
    if (profileId) {
      recordView(profileId);
    }
  }, [profileId, recordView]);

  if (isLoadingProfile) {
    return (
      <ScreenContainer style={styles.centered}>
        <BufferingIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer style={styles.centered}>
        <Text style={{ color: colors.textSecondary, marginBottom: 12 }}>
          Profile not found.
        </Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: colors.primary,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const compatScore = computeCompatibilityScore(profile);

  const onToggleInterest = async () => {
    if (isSending) return;

    // 1. Connected opens relationship actions; messaging remains a separate action.
    if (rel.isMutual) {
      Alert.alert('Connected', `You are connected with ${profile.name}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unconnect', style: 'destructive', onPress: async () => {
          setIsSending(true);
          try {
            const interestId = rel.activeInterest?.id || rel.sent?.id || rel.received?.id;
            if (interestId) {
              await cancelInterest(interestId);
            }
          } catch (error: any) {
            const msg =
              error?.status === 404 ||
              error?.message?.toLowerCase().includes('not found') ||
              error?.message?.toLowerCase().includes('no longer exists')
                ? 'Connection is no longer active.'
                : error?.message ?? 'Please try again.';
            Alert.alert('Could not unconnect', msg);
          } finally {
            setIsSending(false);
          }
        } },
      ]);
      return;
    }

    // 2. If received pending interest from this user, accepting creates a match!
    if (rel.status === 'received' && rel.received) {
      setIsSending(true);
      try {
        await respondToInterest(rel.received.id, 'accepted');
        Alert.alert(
          'It’s a Match! 🎉',
          `You and ${profile.name} are now connected. You can start chatting right away!`,
          [
            { text: 'Later', style: 'cancel' },
            { text: 'Send Message', onPress: onMessage },
          ],
        );
      } catch (err: any) {
        const msg =
          err?.status === 404 ||
          err?.message?.toLowerCase().includes('not found') ||
          err?.message?.toLowerCase().includes('no longer exists')
            ? 'This interest request is no longer active.'
            : err?.message ?? 'Could not accept interest.';
        Alert.alert('Notice', msg);
      } finally {
        setIsSending(false);
      }
      return;
    }

    // 3. If sent pending interest by current user, unsend it
    if (rel.status === 'sent' && rel.sent) {
      setIsSending(true);
      try {
        await cancelInterest(rel.sent.id);
        Alert.alert(
          'Interest Unsent',
          `Your interest to ${profile.name} has been withdrawn.`,
        );
      } catch (err: any) {
        const msg =
          err?.status === 404 ||
          err?.message?.toLowerCase().includes('not found') ||
          err?.message?.toLowerCase().includes('no longer exists')
            ? 'This interest has already been withdrawn or resolved.'
            : err?.message ?? 'Could not unsend interest.';
        Alert.alert('Notice', msg);
      } finally {
        setIsSending(false);
      }
      return;
    }

    // 4. Otherwise, send new interest
    if (allowance.isInterestsExhausted) {
      Alert.alert(
        'Daily Interest Limit Reached',
        `You have used all ${allowance.interestsLimit} daily interests on your ${allowance.planConfig.name}. Your quota resets at 12:00 AM midnight, or upgrade your plan to send more interests!`,
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

    setIsSending(true);
    try {
      await sendInterest(profile.id, profile.userId);
      try {
        const { showInAppNotification } = require('../utils/notifications');
        showInAppNotification({
          title: 'Request Sent! ❤️',
          message: `Interest request sent to ${profile.name}`,
          icon: 'heart',
          type: 'interest',
          avatarUrl: profile.photo || profile.photos?.[0],
        });
      } catch {
        // ignore
      }
      Alert.alert(
        'Request Sent! ❤️',
        `Your interest request has been sent to ${profile.name}. We'll notify you as soon as they respond!`,
        [{ text: 'Awesome', style: 'default' }],
      );
    } catch (err: any) {
      const isLimitError = isInterestQuotaError(err);
      if (isLimitError) {
        allowance.markDailyInterestsExhausted(true);
        Alert.alert(
          'Daily Interest Limit Reached',
          err?.message && err.message.toLowerCase().includes('limit')
            ? err.message
            : `You have reached your daily limit of ${allowance.interestsLimit} interests on your ${allowance.planConfig.name}. Upgrade your plan to send more interests!`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upgrade Plan',
              onPress: () => navigation.navigate('Membership'),
            },
          ],
        );
      } else {
        Alert.alert(
          'Could not update interest',
          err?.message ?? 'Please try again.',
        );
      }
    } finally {
      setIsSending(false);
    }
  };

  const onMessage = async () => {
    if (!profile) return;
    if (!allowance.isPremium) {
      Alert.alert(
        'Premium Required',
        'Direct messaging is a Premium feature. Upgrade to Gold or Elite to chat with verified profiles.',
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
        fallbackName: profile.name,
        fallbackPhoto: profile.photo,
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
        // Fallback: navigate directly to chat with the member instead of blocking with an alert
        navigation.navigate('Chat', {
          chatId: `chat_${profile.id}`,
          otherProfileId: profile.id,
          fallbackName: profile.name,
          fallbackPhoto: profile.photo,
        });
      }
    }
  };

  const handleBlockToggle = () => {
    setShowMenu(false);
    if (iBlocked) {
      unblockUser(profile.id);
    } else {
      blockUser(profile.id);
    }
  };

  const handleShortlistToggle = async () => {
    if (shortlistLoading || isSelf || !profile) return;
    setShortlistLoading(true);
    triggerHaptic('medium');
    try {
      if (toggleShortlistGlobal) {
        await toggleShortlistGlobal(profile.id);
      }
    } catch (err: any) {
      console.warn('[ProfileDetail] Shortlist toggle error:', err?.message);
    } finally {
      setShortlistLoading(false);
    }
  };

  const allPhotos =
    profile.photos && profile.photos.length > 0
      ? profile.photos
      : [profile.photo].filter(Boolean);

  const activePhoto = allPhotos[activeIndex] || allPhotos[0];
  const sourceSize = activePhoto ? photoSizes[activePhoto] : undefined;
  const { width: cardWidth, height: HEADER_IMAGE_HEIGHT } = profilePhotoLayout(
    layoutWidth, height, sourceSize?.width, sourceSize?.height,
  );

  const locationText = [profile.city, profile.state]
    .filter(s => s && s.trim().length > 0)
    .join(', ');

  return (
    <ScreenContainer
      style={styles.container}
      onLayout={event => setLayoutWidth(event.nativeEvent.layout.width)}
    >
      {/* Header participates in layout so scaled text cannot overlap content. */}
      <View style={styles.floatingHeader}>
        <TouchableOpacity
          style={styles.glassBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={22} color="#302330" />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={2}>
          {isSelf ? 'My Profile Preview' : 'Meet your match'}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={handleShareBioData}
            accessibilityLabel="Share profile via WhatsApp"
          >
            <Icon name="share-social-outline" size={20} color="#302330" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.glassBtn}
            onPress={() => setShowMenu(true)}
          >
            <Icon name="ellipsis-horizontal" size={22} color="#302330" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.profileScroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        bounces={false}
        scrollEventThrottle={1}
      >
        {/* Full-screen Carousel Header */}
        <View
          style={[
            styles.photoFrame,
            { width: cardWidth, height: HEADER_IMAGE_HEIGHT },
          ]}
        >
          {allPhotos.length > 0 && (
            <ScrollView
              ref={headerScrollRef}
              horizontal
              pagingEnabled
              scrollEventThrottle={1}
              style={{ height: HEADER_IMAGE_HEIGHT }}
              contentContainerStyle={{ height: HEADER_IMAGE_HEIGHT }}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={e => {
                setActiveIndex(
                  Math.round(e.nativeEvent.contentOffset.x / cardWidth),
                );
              }}
            >
              {allPhotos.map((p, idx) => (
                <View
                  key={idx}
                  style={{
                    width: cardWidth,
                    height: HEADER_IMAGE_HEIGHT,
                    backgroundColor: colors.surfaceTint,
                  }}
                >
                  <AuthImage
                    source={{ uri: p }}
                    style={{ width: cardWidth, height: HEADER_IMAGE_HEIGHT }}
                    onLoad={event => {
                      const size = event.nativeEvent.source;
                      if (!Number.isFinite(size?.width) || !Number.isFinite(size?.height) || size.width <= 0 || size.height <= 0) return;
                      setPhotoSizes(prev => prev[p]?.width === size.width && prev[p]?.height === size.height
                        ? prev : { ...prev, [p]: { width: size.width, height: size.height } });
                    }}
                    showLoading
                    fallbackLabel="Photo unavailable"
                    resizeMode="contain"
                    blurRadius={isPhotoLocked ? 24 : 0}
                  />
                  {isPhotoLocked && (
                    <View style={styles.photoLockOverlay}>
                      <View style={styles.photoLockBadge}>
                        <Icon name="lock-closed" size={24} color="#FFF" />
                        <Text style={styles.photoLockTitle}>Photos Protected</Text>
                        <Text style={styles.photoLockSubtitle}>
                          Full photos unlock once interest is accepted
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

        </View>

        {/* Keep identity readable without covering the photo. */}
        <View style={styles.imageOverlayContent}>
          <View style={styles.imageOverlayRow}>
            <Text style={styles.overlayName} numberOfLines={2}>
              {profile.name}, {profile.age}
            </Text>

            <View style={{ flexDirection: 'row', gap: 6, marginLeft: 12 }}>
              {profile.verificationBadges?.includes('id') && (
                <View
                  style={[
                    styles.verifiedBadgeLarge,
                    {
                      backgroundColor: '#10B981',
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                  ]}
                  accessible
                  accessibilityLabel="ID Verified"
                >
                  <Icon name="shield-checkmark" size={16} color="#FFF" />
                </View>
              )}
              {profile.verificationBadges?.includes('education') && (
                <View
                  style={[
                    styles.verifiedBadgeLarge,
                    {
                      backgroundColor: '#3B82F6',
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                  ]}
                  accessible
                  accessibilityLabel="Education Verified"
                >
                  <Icon name="school" size={16} color="#FFF" />
                </View>
              )}
              {profile.isVerified && !profile.verificationBadges?.length && (
                <View style={styles.verifiedBadgeLarge}>
                  <Icon name="checkmark" size={16} color="#FFF" />
                </View>
              )}
            </View>
          </View>
          {profile.managedBy && profile.managedBy !== 'Self' ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <View
                style={{
                  backgroundColor: 'rgba(165, 55, 96, 0.85)',
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Icon
                  name="people"
                  size={14}
                  color="#FFF"
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={{ color: '#FFF', fontSize: 12, fontWeight: '700' }}
                >
                  Managed by {profile.managedBy}
                </Text>
              </View>
            </View>
          ) : null}
          {locationText ? (
            <Text style={styles.overlayLocation}>
              <Icon name="location" size={16} color={colors.primary} /> {locationText}
            </Text>
          ) : null}

          {/* Photo Indicators */}
          {allPhotos.length > 1 && (
            <View style={styles.photoPills}>
              {allPhotos.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.photoDot,
                    activeIndex === i && styles.photoDotActive,
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Details Bottom Sheet Area */}
        <View style={styles.bottomSheetContainer}>
          {allPhotos.length > 1 && (
            <View style={styles.galleryStripContainer}>
              <View style={styles.galleryStripHeader}>
                <View style={styles.galleryStripTitleRow}>
                  <Icon name="images-outline" size={16} color="#FF5C97" style={{ marginRight: 6 }} />
                  <Text style={styles.galleryStripTitle}>Photo Gallery</Text>
                  <View style={styles.galleryCountBadge}>
                    <Text style={styles.galleryCountText}>{activeIndex + 1}/{allPhotos.length}</Text>
                  </View>
                </View>
                <Text style={styles.galleryStripHint}>Tap photo to preview</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryStripScroll}
                scrollEventThrottle={1}
              >
                {allPhotos.map((p, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => {
                      triggerHaptic('light');
                      headerScrollRef.current?.scrollTo({ x: idx * cardWidth, animated: true });
                      setActiveIndex(idx);
                    }}
                    style={[
                      styles.galleryThumbWrapper,
                      activeIndex === idx && styles.galleryThumbActive,
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`View photo ${idx + 1}`}
                  >
                    <AuthImage
                      source={{ uri: p }}
                      style={styles.galleryThumb}
                      resizeMode="cover"
                      blurRadius={isPhotoLocked ? 10 : 0}
                    />
                    {activeIndex === idx && (
                      <View style={styles.galleryActiveIndicator}>
                        <Icon name="checkmark" size={11} color="#FFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Compatibility Banner */}
          <TouchableOpacity
            style={[styles.matchBanner, compactLayout && styles.stackedBanner]}
            onPress={() => {
              triggerHaptic('light');
              setCompatModalOpen(true);
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View compatibility breakdown"
          >
            <View style={styles.matchBannerLeft}>
              <View style={styles.matchBannerIconWrap}>
                <Icon name="flame" size={18} color="#FF2D78" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.matchBannerText}>
                  {isSelf
                    ? 'Your Profile Overview'
                    : compatScore === null
                      ? 'Explore Match Alignment'
                      : `Match Score • ${compatScore}%`}
                </Text>
                <Text style={styles.matchBannerSub}>
                  {isSelf
                    ? 'Review how potential matches see your matrimonial profile'
                    : 'View the reported score and profile facts'}
                </Text>
              </View>
            </View>
            <View style={styles.matchBannerAction}>
              <Text style={styles.matchBannerActionText}>Details</Text>
              <Icon name="chevron-forward" size={14} color="#B23E69" />
            </View>
          </TouchableOpacity>

          {/* Daily Quota Indicator */}
          <View style={[styles.detailQuotaRow, compactLayout && styles.wrappedQuota]}>
            <View style={styles.detailQuotaPill}>
              <Icon name="heart" size={14} color="#A53760" />
              <Text style={styles.detailQuotaText} >
                {allowance.isInterestsUnlimited
                  ? 'Unlimited'
                  : `${allowance.interestsRemaining} / ${allowance.interestsLimit}`}
              </Text>
            </View>
            <View style={styles.detailQuotaDivider} />
            <View style={styles.detailQuotaPill}>
              <Icon name="eye" size={14} color="#6366F1" />
              <Text style={styles.detailQuotaText} >
                {allowance.isViewsUnlimited
                  ? 'Unlimited'
                  : `${allowance.viewsRemaining} / ${allowance.viewsLimit}`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('Membership')}
              style={[
                styles.detailQuotaPlanBadge,
                { backgroundColor: allowance.planConfig.accentColor + '18' },
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.detailQuotaPlanBadgeText,
                  { color: allowance.planConfig.accentColor },
                ]}
              >
                {allowance.planConfig.badge}
              </Text>
              <Icon
                name="chevron-forward"
                size={11}
                color={allowance.planConfig.accentColor}
              />
            </TouchableOpacity>
          </View>

          {/* Why You Matched - Slide 6 & 10 Transparency */}
          {matchReasons.length > 0 && (
            <View style={styles.whyMatchedCard}>
              <View style={styles.whyMatchedHeader}>
                <Icon name="ribbon" size={15} color="#D97706" />
                <Text style={styles.whyMatchedTitle}>Why you matched</Text>
              </View>
              <Text style={styles.whyMatchedSubtitle}>
                Recommendation based on information you both choose to provide:
              </Text>
              <View style={styles.whyMatchedTags}>
                {matchReasons.map((reason, idx) => (
                  <View key={idx} style={styles.whyMatchedPill}>
                    <Icon name="checkmark-circle" size={13} color="#059669" />
                    <Text style={styles.whyMatchedPillText}>{reason}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Quick Tags */}
          <View style={styles.tagsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsScroll}
              scrollEventThrottle={1}
            >
              {profile.height && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{profile.height}</Text>
                </View>
              )}
              {profile.religion && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{profile.religion}</Text>
                </View>
              )}
              {profile.maritalStatus && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{profile.maritalStatus}</Text>
                </View>
              )}
              {profile.motherTongue && (
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>{profile.motherTongue}</Text>
                </View>
              )}
            </ScrollView>
          </View>

          {/* About Me Card */}
          {profile.about ? (
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Icon name="person" size={20} color={colors.primary} />
                <Text style={styles.cardHeaderTitle}>About Me</Text>
              </View>
              <Text style={styles.aboutText}>{profile.about}</Text>
            </View>
          ) : null}

          {/* Basic Details Grid */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Icon name="list" size={20} color={colors.primary} />
              <Text style={styles.cardHeaderTitle}>Basic Details</Text>
            </View>
            <View style={[styles.detailsGrid, compactLayout && styles.detailsGridCompact]}>
              <DetailItem
                icon="briefcase"
                label="Profession"
                value={profile.profession}
                compact={compactLayout}
              />
              <DetailItem
                icon="business"
                label="Company"
                value={profile.company}
                compact={compactLayout}
              />
              <DetailItem
                icon="school"
                label="Education"
                value={profile.education}
                compact={compactLayout}
              />
              <DetailItem
                icon="cash"
                label="Income"
                value={profile.income}
                compact={compactLayout}
              />
            </View>
          </View>

          {/* Lifestyle & Values (Matrimony specific) */}
          {profile.lifestyle && Object.keys(profile.lifestyle).length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Icon name="leaf" size={20} color={colors.primary} />
                <Text style={styles.cardHeaderTitle}>Lifestyle & Values</Text>
              </View>
              <View style={[styles.detailsGrid, compactLayout && styles.detailsGridCompact]}>
                <DetailItem
                  icon="restaurant"
                  label="Diet"
                  value={profile.lifestyle.diet}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="flame"
                  label="Smoking"
                  value={profile.lifestyle.smoking}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="wine"
                  label="Drinking"
                  value={profile.lifestyle.drinking}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="home"
                  label="Living Arrangement"
                  value={profile.lifestyle.livingArrangement}
                  compact={compactLayout}
                />
              </View>
            </View>
          )}

          {/* Family Details */}
          {(isSelf ||
            profile.fatherStatus ||
            profile.motherStatus ||
            profile.familyType ||
            profile.familyLocation ||
            (profile.websiteFields?.num_brothers !== undefined && profile.websiteFields?.num_brothers !== null) ||
            (profile.websiteFields?.num_sisters !== undefined && profile.websiteFields?.num_sisters !== null)) && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Icon name="home" size={20} color={colors.primary} />
                <Text style={styles.cardHeaderTitle}>Family Details</Text>
              </View>
              <View style={[styles.detailsGrid, compactLayout && styles.detailsGridCompact]}>
                <DetailItem
                  icon="man"
                  label="Father"
                  value={profile.fatherStatus || (isSelf ? 'Not provided' : undefined)}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="woman"
                  label="Mother"
                  value={profile.motherStatus || (isSelf ? 'Not provided' : undefined)}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="people"
                  label="Family Type"
                  value={profile.familyType || (isSelf ? 'Not provided' : undefined)}
                  compact={compactLayout}
                />
                <DetailItem
                  icon="location"
                  label="Location"
                  value={profile.familyLocation || (isSelf ? 'Not provided' : undefined)}
                  compact={compactLayout}
                />
                {profile.websiteFields?.num_brothers !== undefined &&
                  profile.websiteFields?.num_brothers !== null &&
                  String(profile.websiteFields.num_brothers).trim() !== '' && (
                    <DetailItem
                      icon="person-add"
                      label="Brothers"
                      value={String(profile.websiteFields.num_brothers)}
                      compact={compactLayout}
                    />
                  )}
                {profile.websiteFields?.num_sisters !== undefined &&
                  profile.websiteFields?.num_sisters !== null &&
                  String(profile.websiteFields.num_sisters).trim() !== '' && (
                    <DetailItem
                      icon="person-add"
                      label="Sisters"
                      value={String(profile.websiteFields.num_sisters)}
                      compact={compactLayout}
                    />
                  )}
              </View>
            </View>
          )}

          {/* Horoscope & Kundali Compatibility Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Icon name="planet-outline" size={20} color="#D97706" />
              <Text style={styles.cardHeaderTitle}>Horoscope & Kundali</Text>
              <TouchableOpacity
                style={styles.astroMatchPill}
                onPress={() => {
                  triggerHaptic('light');
                  setHoroscopeModalOpen(true);
                }}
                activeOpacity={0.8}
              >
                <Icon name="planet" size={12} color="#D97706" style={{ marginRight: 4 }} />
                <Text style={styles.astroMatchPillText}>
                  View insights
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.detailsGrid, compactLayout && styles.detailsGridCompact]}>
              <DetailItem
                icon="star"
                label="Nakshatra / Star"
                value={profile.starNakshatra || 'Available on request'}
                compact={compactLayout}
              />
              <DetailItem
                icon="flame"
                label="Manglik Status"
                value={profile.manglikStatus || 'Not provided'}
                compact={compactLayout}
              />
              <DetailItem
                icon="compass"
                label="Gothra"
                value={profile.gothra || 'Available on request'}
                compact={compactLayout}
              />
              <DetailItem
                icon="moon"
                label="Horoscope"
                value={profile.horoscope || 'Available on mutual connect'}
                compact={compactLayout}
              />
            </View>

            {/* Gemini Horoscope Match CTA */}
            <TouchableOpacity
              style={styles.geminiAstroCta}
              onPress={() => {
                triggerHaptic('light');
                setHoroscopeModalOpen(true);
              }}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#FFFBEB', '#FEF3C7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.geminiAstroCtaGradient}
              >
                <View style={styles.geminiAstroIconCircle}>
                  <Icon name="planet" size={18} color="#D97706" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.geminiAstroCtaTitle}>Profile Match Insights</Text>
                  <Text style={styles.geminiAstroCtaSub}>
                    Conversation ideas • Optional AI suggestions
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color="#D97706" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* WhatsApp Bio-Data Share Card */}
          <TouchableOpacity
            style={styles.whatsappCard}
            onPress={handleShareBioData}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={['#25D366', '#128C7E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.whatsappGradient}
            >
              <View style={styles.whatsappIconCircle}>
                <Icon name="logo-whatsapp" size={26} color="#FFF" />
              </View>
              <View style={styles.whatsappCopy}>
                <Text style={styles.whatsappTitle}>Share Bio-Data to WhatsApp</Text>
                <Text style={styles.whatsappSub}>
                  Send candidate summary directly to your parents or family
                </Text>
              </View>
              <Icon name="arrow-forward-circle" size={24} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>


        </View>
      </ScrollView>

      {/* Floating Action Bar (Compact Pill Design - No text obscuration) */}
      <View
        style={[
          styles.floatingPillBar,
          { paddingBottom: 12 },
        ]}
      >
        <AnimatedButton
          style={styles.pillActionBtn}
          activeScale={0.9}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close" size={22} color="#6B7280" />
        </AnimatedButton>

        {/* Shortlist / Bookmark Button */}
        {!isSelf && (
          <AnimatedButton
            style={[styles.pillActionBtn, isShortlisted && { backgroundColor: '#FEF3C7' }]}
            activeScale={0.85}
            onPress={handleShortlistToggle}
            disabled={shortlistLoading}
          >
            <Icon
              name={isShortlisted ? 'bookmark' : 'bookmark-outline'}
              size={22}
              color={isShortlisted ? '#D97706' : '#6B7280'}
            />
          </AnimatedButton>
        )}

        {isSelf ? (
          <AnimatedButton
            style={styles.pillPrimaryBtn}
            activeScale={0.94}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <LinearGradient
              colors={[colors.action, colors.actionDark]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            <Icon
              name="pencil"
              size={18}
              color="#FFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.pillPrimaryText}>Edit My Profile</Text>
          </AnimatedButton>
        ) : (
          <AnimatedButton
            style={[
              styles.pillPrimaryBtn,
              rel.status === 'sent' && styles.pillPrimaryUnsend,
            ]}
            activeScale={0.94}
            onPress={onToggleInterest}
            disabled={isSending}
          >
            {rel.status !== 'sent' && (
              <LinearGradient
                colors={
                  rel.isMutual
                    ? ['#059669', '#10B981']
                    : rel.status === 'received'
                      ? ['#10B981', '#059669']
                      : [colors.action, colors.actionDark]
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            )}
            <Icon
              name={
                rel.isMutual
                  ? 'checkmark-circle'
                  : rel.status === 'received'
                    ? 'checkmark-circle'
                    : rel.status === 'sent'
                      ? 'heart-dislike'
                      : 'heart'
              }
              size={18}
              color={rel.status === 'sent' ? '#A53760' : '#FFF'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.pillPrimaryText,
                rel.status === 'sent' && styles.pillPrimaryUnsendText,
              ]}
            >
              {isSending
                ? rel.isMutual
                  ? 'Unconnecting…'
                  : rel.status === 'sent'
                  ? 'Cancelling…'
                  : rel.status === 'received'
                    ? 'Accepting…'
                    : 'Sending…'
                : rel.isMutual
                  ? 'Connected'
                  : rel.status === 'received'
                    ? 'Accept'
                    : rel.status === 'sent'
                      ? 'Request sent'
                      : 'Connect'}
            </Text>
          </AnimatedButton>
        )}

        {!isSelf && rel.isMutual ? (
          <AnimatedButton
            style={styles.pillActionBtn}
            activeScale={0.9}
            onPress={onMessage}
          >
            <Icon
              name="chatbubble-ellipses-outline"
              size={22}
              color={colors.primary}
            />
          </AnimatedButton>
        ) : !isSelf && rel.status === 'received' && rel.received ? (
          <AnimatedButton
            style={styles.pillActionBtn}
            activeScale={0.9}
            onPress={async () => {
              try {
                if (rel.received?.id) {
                  await cancelInterest(rel.received.id);
                }
                Alert.alert(
                  'Declined',
                  `Interest from ${profile.name} has been declined.`,
                );
              } catch (e: any) {
                const msg =
                  e?.status === 404 ||
                  e?.message?.toLowerCase().includes('not found') ||
                  e?.message?.toLowerCase().includes('no longer exists')
                    ? 'This request is no longer active.'
                    : e?.message ?? 'Could not decline interest.';
                Alert.alert(
                  'Notice',
                  msg,
                );
              }
            }}
          >
            <Icon name="close-circle-outline" size={22} color="#9CA3AF" />
          </AnimatedButton>
        ) : null}
      </View>

      <SafetyCenter
        page={reportOpen ? 'report' : null}
        target={{ profileId }}
        onClose={() => setReportOpen(false)}
      />
      {/* Menu Modal */}
      <Modal
        transparent
        visible={showMenu}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowMenu(false)}>
          <View style={styles.menuOverlay}>
            <View style={styles.menuCard}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  handleShareBioData();
                }}
              >
                <Text style={styles.menuItemText}>Share Bio-Data (WhatsApp / Link)</Text>
              </TouchableOpacity>
              {isSelf ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    navigation.navigate('EditProfile');
                  }}
                >
                  <Text style={styles.menuItemText}>Edit My Profile</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleShortlistToggle}
                    disabled={shortlistLoading}
                  >
                    <Text style={styles.menuItemText}>
                      {isShortlisted ? '★ Remove from Shortlist' : '☆ Add to Shortlist'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setShowMenu(false);
                      setReportOpen(true);
                    }}
                  >
                    <Text style={styles.menuItemText}>Report profile or photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={handleBlockToggle}
                  >
                    <Text
                      style={[
                        styles.menuItemText,
                        { color: iBlocked ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {iBlocked ? 'Unblock Member' : 'Block Member'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <GeminiHoroscopeModal
        visible={horoscopeModalOpen}
        onClose={() => setHoroscopeModalOpen(false)}
        analysis={horoscopeAnalysis}
        myProfile={myProfile}
        theirProfile={profile}
      />

      <CompatibilityBreakdownModal
        visible={compatModalOpen}
        onClose={() => setCompatModalOpen(false)}
        myProfile={myProfile}
        theirProfile={profile}
      />
    </ScreenContainer>
  );
}

// Components

function DetailItem({
  icon,
  label,
  value,
  compact,
}: {
  icon: string;
  label: string;
  value?: string;
  compact?: boolean;
}) {
  if (!value) return null;
  return (
    <View style={[styles.detailItem, compact && styles.detailItemCompact]}>
      <View style={styles.detailIconBox}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.detailTextCol}>
        <Text style={styles.detailLabel} numberOfLines={2} ellipsizeMode="tail">
          {label}
        </Text>
        <Text style={styles.detailValue} numberOfLines={2} ellipsizeMode="tail">
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.background },
  profileScroll: { flex: 1 },
  stackedBanner: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  wrappedQuota: { flexWrap: 'wrap', gap: 12, borderRadius: 20 },

  whyMatchedCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  whyMatchedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  whyMatchedTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  whyMatchedSubtitle: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 10,
    lineHeight: 16,
  },
  whyMatchedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  whyMatchedPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  whyMatchedPillText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },

  photoFrame: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F2E6EC',
  },
  navTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    marginHorizontal: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#302330',
    alignSelf: 'center',
  },
  // Floating Header
  floatingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  glassBtn: {
    width: 44,
    height: 44,
    flexShrink: 0,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.roseBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMatchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  headerMatchBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Image Overlay Content
  imageOverlayContent: {
    marginHorizontal: 16,
    paddingTop: 14,
  },
  imageOverlayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 8,
    alignItems: 'center',
    marginBottom: 6,
  },
  overlayName: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  verifiedBadgeLarge: {
    marginLeft: 10,
    backgroundColor: '#10B981',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  overlayLocation: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 8,
  },
  photoPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.roseBorder,
  },
  photoDotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },

  // Bottom Sheet Container
  bottomSheetContainer: {
    backgroundColor: colors.background,
    paddingTop: 18,
    paddingHorizontal: 16,
  },

  // Match Banner
  matchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFEAF2',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  matchBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  matchBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE0EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  matchBannerText: {
    color: '#B23E69',
    fontWeight: '700',
    fontSize: 14,
  },
  matchBannerSub: {
    fontSize: 11,
    color: '#8A4860',
    marginTop: 2,
    fontWeight: '500',
  },
  matchBannerAction: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(178, 62, 105, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  matchBannerActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B23E69',
    marginRight: 2,
  },
  galleryStripContainer: {
    marginBottom: 16,
  },
  galleryStripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  galleryStripTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  galleryStripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  galleryCountBadge: {
    marginLeft: 6,
    backgroundColor: '#FFEAF2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  galleryCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B23E69',
  },
  galleryStripHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  galleryStripScroll: {
    gap: 10,
  },
  galleryThumbWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  galleryThumbActive: {
    borderColor: colors.action,
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  galleryActiveIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.action,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tags
  tagsContainer: {
    marginBottom: 24,
  },
  tagsScroll: {
    gap: 10,
  },
  tagPill: {
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  tagText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },

  // Static Info Cards
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginLeft: 10,
  },
  aboutText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Details Grid
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 16,
  },
  detailsGridCompact: {
    flexDirection: 'column',
    rowGap: 14,
  },
  detailItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItemCompact: {
    width: '100%',
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  detailTextCol: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
    lineHeight: 18,
  },



  // Floating Action Pill Bar
  floatingPillBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: colors.roseBorder,
  },
  pillActionBtn: {
    flexShrink: 0,
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPrimaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pillPrimaryUnsend: {
    backgroundColor: '#FFE4E6',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  pillPrimaryText: {
    flexShrink: 1,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pillPrimaryUnsendText: {
    color: '#A53760',
  },

  // Menu
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuCard: {
    backgroundColor: '#FFF',
    width: '80%',
    maxWidth: 480,
    borderRadius: radii.xl,
    overflow: 'hidden',
  },
  menuItem: {
    padding: 20,
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '700',
  },

  // Detail Quota Row
  detailQuotaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  detailQuotaPill: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailQuotaDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 6,
  },
  detailQuotaText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  detailQuotaPlanBadge: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  detailQuotaPlanBadgeText: {
    flexShrink: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Horoscope & Astro
  astroMatchPill: {
    marginLeft: 'auto',
    backgroundColor: '#FEF3C7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  astroMatchPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  geminiAstroCta: {
    marginTop: 14,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  geminiAstroCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  geminiAstroIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  geminiAstroCtaTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  geminiAstroCtaSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 2,
  },

  // WhatsApp Bio-Data Card
  whatsappCard: {
    marginVertical: 12,
    borderRadius: radii.xxl,
    overflow: 'hidden',
    ...shadow.sm,
  },
  whatsappGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  whatsappIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  whatsappCopy: {
    flex: 1,
    marginRight: 8,
  },
  whatsappTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
  },
  whatsappSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    lineHeight: 15,
  },

  // Photo Lock Protection
  photoLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  photoLockBadge: {
    backgroundColor: 'rgba(24, 24, 27, 0.75)',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: radii.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  photoLockTitle: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 8,
  },
  photoLockSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
