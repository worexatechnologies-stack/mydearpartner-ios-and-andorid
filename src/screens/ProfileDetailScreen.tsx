import BufferingIndicator from '../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
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
import SafetyCenter from '../components/SafetyCenter';
import ScreenContainer from '../components/ScreenContainer';
import { useAppData } from '../context/AppDataContext';
import { RootStackParamList } from '../navigation/types';
import { colors, radii, shadow } from '../theme/theme';
import { Profile } from '../types/models';
import { computeCompatibilityScore } from '../utils/compatibility';
import { triggerHaptic } from '../utils/haptics';
import { isInterestQuotaError } from '../utils/interestErrors';
import { usePlanAllowance } from '../utils/planAllowance';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileDetail'>;

export default function ProfileDetailScreen({ route, navigation }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
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
  } = useAppData();

  const cachedProfile = getProfileById(profileId);
  const [profile, setProfile] = useState<Profile | null>(cachedProfile || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState<boolean>(
    !cachedProfile,
  );

  useEffect(() => {
    if (cachedProfile) {
      setProfile(cachedProfile);
      setIsLoadingProfile(false);
      return;
    }

    let isMounted = true;
    setIsLoadingProfile(true);
    fetchProfileById(profileId)
      .then(res => {
        if (isMounted) {
          setProfile(res);
          setIsLoadingProfile(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [profileId, cachedProfile]);

  const rel = getInterestRelationship(profileId);
  const existingInterest = rel.activeInterest || interestStatusFor(profileId);
  const iBlocked = isBlockedByMe(profileId);

  const [activeIndex, setActiveIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const allowance = usePlanAllowance();
  const { recordView } = allowance;

  const isPhotoLocked = Boolean(
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

    // 1. If already mutually matched, open chat
    if (rel.isMutual) {
      await onMessage();
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
        Alert.alert('Notice', err?.message ?? 'Could not accept interest.');
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
        Alert.alert('Notice', err?.message ?? 'Could not unsend interest.');
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
  };

  const handleBlockToggle = () => {
    setShowMenu(false);
    if (iBlocked) {
      unblockUser(profile.id);
    } else {
      blockUser(profile.id);
    }
  };

  const allPhotos =
    profile.photos && profile.photos.length > 0
      ? profile.photos
      : [profile.photo].filter(Boolean);

  const cardWidth = width - 32;
  const HEADER_IMAGE_HEIGHT = Math.min(460, height * 0.46);

  const locationText = [profile.city, profile.state]
    .filter(s => s && s.trim().length > 0)
    .join(', ');

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1, marginTop: insets.top + 64 }}
        contentContainerStyle={{ paddingBottom: 24 }} // Space for floating action bar
        bounces={false}
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
              horizontal
              pagingEnabled
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
                    height: '100%',
                    backgroundColor: colors.surface,
                  }}
                >
                  <AuthImage
                    source={{ uri: p }}
                    style={{ width: '100%', height: '100%' }}
                    showLoading
                    fallbackLabel="Photo unavailable"
                    resizeMode="cover"
                    blurRadius={isPhotoLocked ? 24 : 0}
                  />
                  <LinearGradient
                    colors={[
                      'rgba(0,0,0,0.05)',
                      'transparent',
                      'rgba(0,0,0,0.7)',
                    ]}
                    locations={[0, 0.35, 1]}
                    style={StyleSheet.absoluteFill}
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

          {/* Image Content Overlay (Name & Details at bottom of image) */}
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
                <Icon name="location" size={16} color="#FFF" /> {locationText}
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
        </View>

        {/* Details Bottom Sheet Area */}
        <View style={styles.bottomSheetContainer}>
          {/* Compatibility Banner */}
          <View style={styles.matchBanner}>
            <Icon name="flame" size={18} color="#FF2D78" />
            <Text style={styles.matchBannerText}>
              {compatScore === null
                ? 'Get to know this member'
                : `Match score • ${compatScore}%`}
            </Text>
          </View>

          {/* Daily Quota Indicator */}
          <View style={styles.detailQuotaRow}>
            <View style={styles.detailQuotaPill}>
              <Icon name="heart" size={14} color="#A53760" />
              <Text style={styles.detailQuotaText} numberOfLines={1}>
                {allowance.isInterestsUnlimited
                  ? 'Unlimited'
                  : `${allowance.interestsRemaining} / ${allowance.interestsLimit}`}
              </Text>
            </View>
            <View style={styles.detailQuotaDivider} />
            <View style={styles.detailQuotaPill}>
              <Icon name="eye" size={14} color="#6366F1" />
              <Text style={styles.detailQuotaText} numberOfLines={1}>
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

          {/* Quick Tags */}
          <View style={styles.tagsContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tagsScroll}
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
            <View style={styles.detailsGrid}>
              <DetailItem
                icon="briefcase"
                label="Profession"
                value={profile.profession}
              />
              <DetailItem
                icon="business"
                label="Company"
                value={profile.company}
              />
              <DetailItem
                icon="school"
                label="Education"
                value={profile.education}
              />
              <DetailItem icon="cash" label="Income" value={profile.income} />
            </View>
          </View>

          {/* Lifestyle & Values (Matrimony specific) */}
          {profile.lifestyle && Object.keys(profile.lifestyle).length > 0 && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Icon name="leaf" size={20} color={colors.primary} />
                <Text style={styles.cardHeaderTitle}>Lifestyle & Values</Text>
              </View>
              <View style={styles.detailsGrid}>
                <DetailItem
                  icon="restaurant"
                  label="Diet"
                  value={profile.lifestyle.diet}
                />
                <DetailItem
                  icon="flame"
                  label="Smoking"
                  value={profile.lifestyle.smoking}
                />
                <DetailItem
                  icon="wine"
                  label="Drinking"
                  value={profile.lifestyle.drinking}
                />
                <DetailItem
                  icon="home"
                  label="Living Arrangement"
                  value={profile.lifestyle.livingArrangement}
                />
              </View>
            </View>
          )}

          {/* Family Details (Only if connected/accepted) */}
          {existingInterest?.status === 'accepted' && (
            <View style={styles.infoCard}>
              <View style={styles.cardHeaderRow}>
                <Icon name="home" size={20} color={colors.primary} />
                <Text style={styles.cardHeaderTitle}>Family Details</Text>
              </View>
              <View style={styles.detailsGrid}>
                <DetailItem
                  icon="man"
                  label="Father"
                  value={profile.fatherStatus}
                />
                <DetailItem
                  icon="woman"
                  label="Mother"
                  value={profile.motherStatus}
                />
                <DetailItem
                  icon="people"
                  label="Family Type"
                  value={profile.familyType}
                />
                <DetailItem
                  icon="location"
                  label="Location"
                  value={profile.familyLocation}
                />
              </View>
            </View>
          )}

          {/* Horoscope & Kundali Compatibility Card */}
          <View style={styles.infoCard}>
            <View style={styles.cardHeaderRow}>
              <Icon name="planet-outline" size={20} color="#D97706" />
              <Text style={styles.cardHeaderTitle}>Horoscope & Kundali</Text>
              <View style={styles.astroMatchPill}>
                <Text style={styles.astroMatchPillText}>
                  {compatScore ? `${Math.round(compatScore * 0.36)}/36 Gunas` : 'High Match'}
                </Text>
              </View>
            </View>
            <View style={styles.detailsGrid}>
              <DetailItem
                icon="star"
                label="Nakshatra / Star"
                value={profile.starNakshatra || 'Available on request'}
              />
              <DetailItem
                icon="flame"
                label="Manglik Status"
                value={profile.manglikStatus || 'Non-Manglik'}
              />
              <DetailItem
                icon="compass"
                label="Gothra"
                value={profile.gothra || 'Available on request'}
              />
              <DetailItem
                icon="moon"
                label="Horoscope"
                value={profile.horoscope || 'Available on mutual connect'}
              />
            </View>
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

          {/* Hinge-style Prompts */}
          {profile.prompts && profile.prompts.length > 0 && (
            <View style={styles.promptsSection}>
              <Text style={styles.promptsSectionTitle}>
                More about {profile.name.split(' ')[0]}
              </Text>
              {profile.prompts.map((prompt, index) => (
                <View key={index} style={styles.promptCard}>
                  <Text style={styles.promptQuestion}>{prompt.question}</Text>
                  <Text style={styles.promptAnswer}>{prompt.answer}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Header (Absolute) */}
      <View style={[styles.floatingHeader, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.glassBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="chevron-back" size={22} color="#302330" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Meet your match</Text>
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

      {/* Floating Action Bar (Compact Pill Design - No text obscuration) */}
      <View
        style={[
          styles.floatingPillBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <TouchableOpacity
          style={styles.pillActionBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Icon name="close" size={22} color="#6B7280" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.pillPrimaryBtn,
            rel.status === 'sent' && styles.pillPrimaryUnsend,
          ]}
          onPress={onToggleInterest}
          disabled={isSending}
          activeOpacity={0.8}
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
                ? 'chatbubble-ellipses'
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
              ? rel.status === 'sent'
                ? 'Unsending…'
                : rel.status === 'received'
                ? 'Accepting…'
                : 'Sending…'
              : rel.isMutual
              ? 'Message Partner'
              : rel.status === 'received'
              ? 'Respond to Request'
              : rel.status === 'sent'
              ? 'Pending Request'
              : 'Connect'}
          </Text>
        </TouchableOpacity>

        {rel.isMutual ? (
          <TouchableOpacity
            style={styles.pillActionBtn}
            onPress={onMessage}
            activeOpacity={0.8}
          >
            <Icon
              name="chatbubble-ellipses-outline"
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : rel.status === 'received' && rel.received ? (
          <TouchableOpacity
            style={styles.pillActionBtn}
            onPress={async () => {
              try {
                await cancelInterest(rel.received!.id);
                Alert.alert(
                  'Declined',
                  `Interest from ${profile.name} has been declined.`,
                );
              } catch (e: any) {
                Alert.alert(
                  'Notice',
                  e?.message ?? 'Could not decline interest.',
                );
              }
            }}
            activeOpacity={0.8}
          >
            <Icon name="close-circle-outline" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 48 }} />
        )}
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
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

// Components

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailIconBox}>
        <Icon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.detailTextCol}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: colors.background },

  photoFrame: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F2E6EC',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#302330',
    alignSelf: 'center',
  },
  // Floating Header
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  glassBtn: {
    width: 42,
    height: 42,
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
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 5,
  },
  imageOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  overlayName: {
    flexShrink: 1,
    fontSize: 26,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
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
    color: '#E2E8F0',
    fontWeight: '600',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  photoDotActive: {
    backgroundColor: '#FFF',
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
    backgroundColor: '#FFEAF2',
    padding: 14,
    borderRadius: 16,
    marginBottom: 14,
  },
  matchBannerText: {
    color: '#B23E69',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 10,
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
    alignItems: 'center',
    marginBottom: 16,
  },
  cardHeaderTitle: {
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
    gap: 20,
  },
  detailItem: {
    width: '45%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  detailTextCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },

  // Prompts Section
  promptsSection: {
    marginTop: 8,
    marginBottom: 40,
  },
  promptsSectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.text,
    marginBottom: 20,
  },
  promptCard: {
    backgroundColor: colors.background,
    borderRadius: radii.xxl,
    padding: 24,
    marginBottom: 16,
    borderLeftWidth: 6,
    borderLeftColor: colors.primary,
    ...shadow.sm,
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  promptAnswer: {
    fontSize: 20,
    color: colors.text,
    fontWeight: '700',
    lineHeight: 28,
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
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPrimaryBtn: {
    flex: 1,
    height: 48,
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
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  detailQuotaPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  detailQuotaPlanBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Horoscope & Astro
  astroMatchPill: {
    marginLeft: 'auto',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  astroMatchPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
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
