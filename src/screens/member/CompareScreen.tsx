import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import AuthImage from '../../components/AuthImage';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { colors, fontSizes, radii, shadow, spacing } from '../../theme/theme';
import { Profile } from '../../types/models';
import { computeCompatibilityScore } from '../../utils/compatibility';
import { triggerHaptic } from '../../utils/haptics';
import { isInterestQuotaError } from '../../utils/interestErrors';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = NativeStackScreenProps<RootStackParamList, 'Compare'>;

export default function CompareScreen({ route, navigation }: Props) {
  const { currentUser } = useAuth();
  const {
    discoverProfiles,
    chats,
    sentInterests,
    receivedInterests,
    getProfileById,
    sendInterest,
    cancelInterest,
    getInterestRelationship,
    respondToInterest,
    getOrCreateChatWith,
  } = useAppData();
  const allowance = usePlanAllowance();

  const myProfile = currentUser?.profile;

  // Filter ONLY connected people (active chats, accepted interests, or mutual matches)
  const connectedProfiles = React.useMemo(() => {
    const map = new Map<string, Profile>();

    // 1. Profiles from active chats
    (chats ?? []).forEach(chat => {
      if (chat.otherProfile && chat.otherProfile.id) {
        map.set(chat.otherProfile.id, chat.otherProfile);
      }
    });

    // 2. Profiles with accepted interests
    (sentInterests ?? []).forEach(interest => {
      if (interest.status === 'accepted') {
        const p = interest.receiverProfile || getProfileById?.(interest.toUserId);
        if (p && p.id) map.set(p.id, p);
      }
    });

    (receivedInterests ?? []).forEach(interest => {
      if (interest.status === 'accepted') {
        const p = interest.senderProfile || getProfileById?.(interest.fromUserId);
        if (p && p.id) map.set(p.id, p);
      }
    });

    // 3. Any cached profile that has a mutual/accepted relationship
    (discoverProfiles ?? []).forEach(p => {
      const rel = getInterestRelationship?.(p.id);
      if (rel && (rel.isMutual || rel.status === 'accepted')) {
        map.set(p.id, p);
      }
    });

    return Array.from(map.values());
  }, [
    chats,
    sentInterests,
    receivedInterests,
    discoverProfiles,
    getProfileById,
    getInterestRelationship,
  ]);

  // Find the partner candidate to compare against from connected profiles only
  const paramCandidateId = route.params?.profileId2 ?? route.params?.profileId1;
  const initialCandidate = React.useMemo(() => {
    if (paramCandidateId) {
      const found = connectedProfiles.find(p => p.id === paramCandidateId);
      if (found) return found;
      const cached =
        (discoverProfiles ?? []).find(p => p.id === paramCandidateId) ??
        getProfileById?.(paramCandidateId);
      if (cached) return cached;
    }
    return connectedProfiles[0];
  }, [paramCandidateId, connectedProfiles, discoverProfiles, getProfileById]);

  const [candidate, setCandidate] = useState<Profile | undefined>(
    initialCandidate,
  );

  React.useEffect(() => {
    if (!candidate && initialCandidate) {
      setCandidate(initialCandidate);
    }
  }, [candidate, initialCandidate]);

  const [showPicker, setShowPicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const matchScore = computeCompatibilityScore(candidate);
  const relationship = candidate
    ? getInterestRelationship(candidate.id)
    : undefined;
  const hasConnection = relationship && relationship.status !== 'none';

  const handleToggleInterest = async () => {
    if (!candidate || isSending) return;
    triggerHaptic('light');
    setIsSending(true);
    try {
      if (relationship?.isMutual) {
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
        const chat = await getOrCreateChatWith(candidate.id);
        navigation.navigate('Chat', {
          chatId: chat.id,
          otherProfileId: candidate.id,
        });
        return;
      }
      if (relationship?.status === 'received' && relationship.received) {
        await respondToInterest(relationship.received.id, 'accepted');
        Alert.alert(
          'It’s a Match!',
          `You and ${candidate.name} are now connected.`,
        );
        return;
      }
      if (relationship?.status === 'sent' && relationship.sent) {
        await cancelInterest(relationship.sent.id);
        Alert.alert(
          'Interest Unsent',
          `Your interest to ${candidate.name} has been withdrawn.`,
        );
      } else {
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
        await sendInterest(candidate.id, candidate.userId);
        try {
          const {
            showInAppNotification,
          } = require('../../utils/notifications');
          showInAppNotification({
            title: 'Request Sent! ❤️',
            message: `Interest request sent to ${candidate.name}`,
            icon: 'heart',
            type: 'interest',
            avatarUrl: candidate.photo || candidate.photos?.[0],
          });
        } catch {
          // ignore
        }
        Alert.alert(
          'Request Sent! ❤️',
          `Your interest request has been sent to ${candidate.name}. We'll notify you as soon as they respond!`,
          [{ text: 'Awesome', style: 'default' }],
        );
      }
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
      } else if (
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
        Alert.alert('Notice', err?.message ?? 'Could not update interest.');
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Compare Compatibility</Text>
          <Text style={styles.subtitle}>
            See how well you align with your connected partners
          </Text>
        </View>

        {!candidate && connectedProfiles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Icon name="people-outline" size={42} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Connected Partners Yet</Text>
            <Text style={styles.emptyDescription}>
              Compatibility comparison is only available for connected partners. Once you and another member connect or accept an interest, you can compare detailed compatibility here.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => (navigation as any).navigate('Main', { screen: 'Discover' })}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.action, colors.actionDark]}
                style={styles.emptyActionGradient}
              >
                <Icon name="compass-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
                <Text style={styles.emptyActionText}>Explore Discover Matches</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          <>

        {/* Profile Comparison Cards */}
        <View style={styles.candidatesRow}>
          {/* ── Left Card: ME (Current User) ── */}
          <View style={[styles.candidateCard, styles.meCard]}>
            <View style={styles.badgePillMe}>
              <Icon
                name="person"
                size={10}
                color="#6366F1"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.badgePillMeText}>You</Text>
            </View>

            {myProfile?.photo ? (
              <AuthImage
                source={{ uri: myProfile.photo }}
                style={styles.candidatePhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.candidatePhoto, styles.placeholderPhoto]}>
                <Icon name="person" size={32} color={colors.primary} />
              </View>
            )}

            <Text style={styles.candidateName} numberOfLines={1}>
              {myProfile?.name ? myProfile.name.split(' ')[0] : 'You'}
            </Text>
            <Text style={styles.candidateSub} numberOfLines={1}>
              {myProfile?.age ? `${myProfile.age} yrs` : 'My Profile'}
            </Text>

            <TouchableOpacity
              style={styles.profileLink}
              onPress={() =>
                (navigation as any).navigate('Main', { screen: 'MyProfile' })
              }
            >
              <Text style={styles.profileLinkText}>My Profile</Text>
            </TouchableOpacity>
          </View>

          {/* ── Center VS Badge ── */}
          <View style={styles.vsContainer}>
            <LinearGradient
              colors={['#FFF1F2', '#FFE4E6']}
              style={styles.vsBadge}
            >
              <Text style={styles.vsText}>VS</Text>
            </LinearGradient>
            <View style={styles.compatibilityBubble}>
              <Icon name="heart" size={10} color="#B45309" />
              <Text style={styles.compatibilityBubbleText}>
                {matchScore === null ? 'View profile' : `${matchScore}%`}
              </Text>
            </View>
          </View>

          {/* ── Right Card: Candidate ── */}
          <TouchableOpacity
            style={[styles.candidateCard, styles.partnerCard]}
            onPress={() => {
              triggerHaptic('light');
              setShowPicker(true);
            }}
            activeOpacity={0.88}
          >
            <View style={styles.badgePillPartner}>
              <Icon
                name="checkmark-circle"
                size={10}
                color="#A53760"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.badgePillPartnerText}>
                {matchScore === null
                  ? 'View profile'
                  : `${
                      matchScore === null ? 'View profile' : `${matchScore}%`
                    } Match`}
              </Text>
            </View>

            {candidate?.photo ? (
              <AuthImage
                source={{ uri: candidate.photo }}
                style={styles.candidatePhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.candidatePhoto, styles.placeholderPhoto]}>
                <Icon name="person" size={32} color={colors.primary} />
              </View>
            )}

            <Text style={styles.candidateName} numberOfLines={1}>
              {candidate ? candidate.name.split(' ')[0] : 'Select'}
            </Text>
            <Text style={styles.candidateSub} numberOfLines={1}>
              {candidate
                ? `${candidate.age} yrs • Tap to switch`
                : 'Tap to select'}
            </Text>

            {candidate && (
              <TouchableOpacity
                style={styles.profileLink}
                onPress={() =>
                  navigation.navigate('ProfileDetail', {
                    profileId: candidate.id,
                  })
                }
              >
                <Text style={styles.profileLinkText}>View Details</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {/* Comparison Table */}
        <View style={styles.tableCard}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableColHeader, { textAlign: 'right' }]}>
              You
            </Text>
            <Text style={styles.tableColHeaderCenter}>Attribute</Text>
            <Text style={[styles.tableColHeader, { textAlign: 'left' }]}>
              {candidate ? candidate.name.split(' ')[0] : 'Partner'}
            </Text>
          </View>

          <CompareRow
            label="Age"
            val1={myProfile?.age ? `${myProfile.age} yrs` : '—'}
            val2={candidate?.age ? `${candidate.age} yrs` : '—'}
          />
          <CompareRow
            label="Height"
            val1={myProfile?.height || '—'}
            val2={candidate?.height || '—'}
          />
          <CompareRow
            label="Religion"
            val1={myProfile?.religion || '—'}
            val2={candidate?.religion || '—'}
          />
          <CompareRow
            label="City"
            val1={myProfile?.city || '—'}
            val2={candidate?.city || '—'}
          />
          <CompareRow
            label="Education"
            val1={myProfile?.education || '—'}
            val2={candidate?.education || '—'}
          />
          <CompareRow
            label="Profession"
            val1={myProfile?.profession || '—'}
            val2={candidate?.profession || '—'}
          />
          <CompareRow
            label="Income"
            val1={myProfile?.income || '—'}
            val2={candidate?.income || '—'}
          />
          <CompareRow
            label="Marital Status"
            val1={myProfile?.maritalStatus || '—'}
            val2={candidate?.maritalStatus || '—'}
          />
          <CompareRow
            label="Mother Tongue"
            val1={myProfile?.motherTongue || '—'}
            val2={candidate?.motherTongue || '—'}
          />
          <CompareRow
            label="Diet"
            val1={myProfile?.diet || '—'}
            val2={candidate?.diet || '—'}
          />
        </View>

        {/* Action Button for the Candidate */}
        {candidate && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[
                styles.connectBtn,
                hasConnection ? styles.connectBtnSent : null,
              ]}
              onPress={handleToggleInterest}
              disabled={isSending}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={
                  hasConnection
                    ? ['#10B981', '#059669']
                    : colors.gradientPrimary
                }
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              <Icon
                name={
                  relationship?.isMutual
                    ? 'chatbubble'
                    : relationship?.status === 'sent'
                    ? 'heart-dislike'
                    : 'heart'
                }
                size={18}
                color="#FFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.connectBtnText}>
                {isSending
                  ? 'Updating…'
                  : relationship?.isMutual
                  ? 'Send Message'
                  : relationship?.status === 'received'
                  ? 'Accept Interest'
                  : relationship?.status === 'sent'
                  ? 'Interest Sent (Tap to Unsend)'
                  : `Express Interest to ${candidate.name.split(' ')[0]}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.switchCandidateBtn}
              onPress={() => setShowPicker(true)}
              activeOpacity={0.8}
            >
              <Icon
                name="swap-horizontal"
                size={16}
                color={colors.primary}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.switchCandidateBtnText}>Change Partner</Text>
            </TouchableOpacity>
          </View>
        )}
        </>
        )}
      </ScrollView>

      {/* Modal picker for partner profiles */}
      <Modal
        visible={showPicker}
        onRequestClose={() => setShowPicker(false)}
        transparent
        animationType="slide"
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setShowPicker(false)}>
          <View style={styles.pickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerContent}>
                <View style={styles.pickerHeader}>
                  <View>
                    <Text style={styles.pickerTitle}>
                      Select Connected Partner
                    </Text>
                    <Text style={styles.pickerSubtitle}>
                      Choose from your connected partners ({connectedProfiles.length})
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowPicker(false)}
                    style={styles.pickerCloseBtn}
                  >
                    <Icon name="close" size={20} color="#4B5563" />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={connectedProfiles}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingBottom: 30 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={styles.pickerEmpty}>
                      <Text style={styles.pickerEmptyText}>No connected partners found.</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const isCurrent = candidate?.id === item.id;
                    const itemScore = computeCompatibilityScore(item);
                    return (
                      <TouchableOpacity
                        style={[
                          styles.pickerItem,
                          isCurrent && styles.pickerItemActive,
                        ]}
                        onPress={() => {
                          triggerHaptic('light');
                          setCandidate(item);
                          setShowPicker(false);
                        }}
                      >
                        {item.photo ? (
                          <AuthImage
                            source={{ uri: item.photo }}
                            style={styles.pickerItemPhoto}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.pickerItemPhoto,
                              styles.placeholderPhoto,
                            ]}
                          >
                            <Icon
                              name="person"
                              size={22}
                              color={colors.primary}
                            />
                          </View>
                        )}
                        <View style={styles.pickerItemInfo}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <Text
                              style={styles.pickerItemName}
                              numberOfLines={1}
                            >
                              {item.name}, {item.age}
                            </Text>
                            {item.isVerified && (
                              <View style={styles.verifiedDot}>
                                <Icon name="checkmark" size={7} color="#FFF" />
                              </View>
                            )}
                          </View>
                          <Text style={styles.pickerItemSub} numberOfLines={1}>
                            {[item.profession, item.city]
                              .filter(Boolean)
                              .join(' • ') || 'Verified Member'}
                          </Text>
                        </View>
                        <View style={styles.pickerScoreBadge}>
                          <Icon
                            name="checkmark-circle"
                            size={10}
                            color="#A53760"
                          />
                          <Text style={styles.pickerScoreText}>
                            {' '}
                            {itemScore}%
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ScreenContainer>
  );
}

function CompareRow({
  label,
  val1,
  val2,
}: {
  label: string;
  val1: string;
  val2: string;
}) {
  const isMatch =
    val1 &&
    val2 &&
    val1 !== '—' &&
    val2 !== '—' &&
    val1.trim().toLowerCase() === val2.trim().toLowerCase();

  return (
    <View style={[styles.row, isMatch && styles.rowMatch]}>
      <Text
        style={[styles.valLeft, isMatch && styles.valMatchText]}
        numberOfLines={2}
      >
        {val1}
      </Text>
      <View
        style={[styles.labelContainer, isMatch && styles.labelContainerMatch]}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Text style={[styles.rowLabel, isMatch && styles.rowLabelMatch]}>
            {label}
          </Text>
          {isMatch && (
            <Icon name="checkmark-circle" size={12} color={colors.success} />
          )}
        </View>
      </View>
      <Text
        style={[styles.valRight, isMatch && styles.valMatchText]}
        numberOfLines={2}
      >
        {val2}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  header: {
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  candidatesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: spacing.md,
  },
  candidateCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  meCard: {
    borderTopWidth: 3,
    borderTopColor: '#6366F1',
  },
  partnerCard: {
    borderTopWidth: 3,
    borderTopColor: colors.primary,
  },
  badgePillMe: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
  },
  badgePillMeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6366F1',
  },
  badgePillPartner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    marginBottom: spacing.xs,
  },
  badgePillPartnerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A53760',
  },
  candidatePhoto: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#F1F5F9',
    marginBottom: spacing.xs,
  },
  placeholderPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FCE7F3',
  },
  candidateName: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginTop: 2,
  },
  candidateSub: {
    fontSize: 11,
    color: colors.textLight,
    fontWeight: '600',
    marginTop: 1,
    textAlign: 'center',
  },
  profileLink: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: '#F8FAFC',
    borderRadius: radii.pill,
  },
  profileLinkText: {
    fontSize: fontSizes.xs - 1,
    fontWeight: '700',
    color: colors.primary,
  },
  vsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  vsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  vsText: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.primary,
  },
  compatibilityBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    marginTop: 4,
  },
  compatibilityBubbleText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#B45309',
    marginLeft: 2,
  },
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...shadow.card,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: radii.xl - 1,
    borderTopRightRadius: radii.xl - 1,
  },
  tableColHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: spacing.xs,
  },
  tableColHeaderCenter: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowMatch: {
    backgroundColor: '#F0FDF4',
  },
  labelContainer: {
    paddingHorizontal: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: radii.sm,
    paddingVertical: 3,
  },
  labelContainerMatch: {
    backgroundColor: '#DCFCE7',
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  rowLabelMatch: {
    color: '#15803D',
  },
  valLeft: {
    flex: 1,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'right',
    paddingRight: spacing.sm,
  },
  valRight: {
    flex: 1,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'left',
    paddingLeft: spacing.sm,
  },
  valMatchText: {
    fontWeight: '700',
    color: '#166534',
  },
  actionsRow: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  connectBtn: {
    height: 48,
    borderRadius: radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...shadow.sm,
  },
  connectBtnSent: {
    backgroundColor: colors.success,
  },
  connectBtnText: {
    color: colors.white,
    fontSize: fontSizes.sm,
    fontWeight: '800',
  },
  switchCandidateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  switchCandidateBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 30, 0.65)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    padding: spacing.md,
    maxHeight: '75%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  pickerTitle: {
    fontSize: fontSizes.md,
    fontWeight: '800',
    color: colors.text,
  },
  pickerSubtitle: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  pickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: radii.md,
  },
  pickerItemActive: {
    backgroundColor: '#FFF1F2',
  },
  pickerItemPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: spacing.md,
    backgroundColor: '#F1F5F9',
  },
  pickerItemInfo: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 2,
  },
  pickerItemSub: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
  },
  verifiedDot: {
    backgroundColor: '#10B981',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  pickerScoreText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#A53760',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    backgroundColor: colors.surface,
    borderRadius: radii.xxl,
    marginVertical: 16,
    ...shadow.card,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFEAF2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyActionBtn: {
    width: '100%',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  emptyActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  pickerEmpty: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  pickerEmptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
