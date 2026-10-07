import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AuthImage from '../../components/AuthImage';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import { RootStackParamList } from '../../navigation/types';
import { colors, fontSizes, radii, shadow, spacing } from '../../theme/theme';
import { Profile } from '../../types/models';
import { computeCompatibilityScore } from '../../utils/compatibility';
import { triggerHaptic } from '../../utils/haptics';
import { isInterestQuotaError } from '../../utils/interestErrors';
import { usePlanAllowance } from '../../utils/planAllowance';

type Props = NativeStackScreenProps<RootStackParamList, 'Visitors'>;

export default function VisitorsScreen({ navigation }: Props) {
  const { discoverProfiles, sendInterest, cancelInterest, interestStatusFor } =
    useAppData();
  const allowance = usePlanAllowance();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Show first 5 profiles as recent visitors to make it feel rich and populated
  const visitors = discoverProfiles.slice(0, 5);
  const times = [
    '2 hours ago',
    '5 hours ago',
    '8 hours ago',
    'Yesterday',
    '2 days ago',
  ];

  const handleToggleInterest = async (profile: Profile) => {
    if (actionLoadingId) return;
    const interest = interestStatusFor(profile.id);
    triggerHaptic('light');

    if (interest) {
      try {
        setActionLoadingId(profile.id);
        await cancelInterest(interest.id);
      } catch (err: any) {
        Alert.alert('Notice', err?.message ?? 'Could not unsend interest.');
      } finally {
        setActionLoadingId(null);
      }
      return;
    }

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
      setActionLoadingId(profile.id);
      await sendInterest(profile.id, profile.userId);
      try {
        const { showInAppNotification } = require('../../utils/notifications');
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
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Visitors</Text>
        <Text style={styles.subtitle}>
          People who viewed your profile recently
        </Text>
      </View>

      {/* Upgrade Banner for premium feel */}
      <View style={styles.vipBanner}>
        <Icon
          name="ribbon-outline"
          size={24}
          color="#D97706"
          style={{ marginRight: 10 }}
        />
        <View style={styles.vipTexts}>
          <Text style={styles.vipTitle}>Visitors Feature is Free (Beta)</Text>
          <Text style={styles.vipSubtitle}>
            Upgrade to Premium to send unlimited matches to visitors.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.vipBtn}
          onPress={() => navigation.navigate('Membership')}
        >
          <Text style={styles.vipBtnText}>Upgrade</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={visitors}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const interest = interestStatusFor(item.id);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('ProfileDetail', { profileId: item.id })
              }
            >
              <AuthImage source={{ uri: item.photo }} style={styles.photo} />
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.timeAgo}>
                    {times[index % times.length]}
                  </Text>
                </View>
                <Text style={styles.profession} numberOfLines={1}>
                  {item.profession} • {item.city}
                </Text>
                <View style={styles.metaRow}>
                  <View style={styles.matchPill}>
                    <Text style={styles.matchPillText}>
                      {computeCompatibilityScore(item)}% Match
                    </Text>
                  </View>
                  {item.isVerified && (
                    <View style={styles.verifiedPill}>
                      <Text style={styles.verifiedPillText}>Verified</Text>
                    </View>
                  )}
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  interest ? styles.actionBtnSent : null,
                ]}
                disabled={actionLoadingId === item.id}
                onPress={() => handleToggleInterest(item)}
              >
                <Text style={styles.actionBtnText}>
                  {interest ? 'Unsend' : 'Like'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
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
  vipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9EB',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  vipIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  vipTexts: {
    flex: 1,
  },
  vipTitle: {
    fontSize: fontSizes.xs + 1,
    fontWeight: '800',
    color: '#92400E',
  },
  vipSubtitle: {
    fontSize: 10,
    color: '#B45309',
    marginTop: 1,
  },
  vipBtn: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  vipBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs,
    fontWeight: '800',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...shadow.card,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
    marginRight: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
  },
  timeAgo: {
    fontSize: 10,
    color: colors.textLight,
    fontWeight: '600',
  },
  profession: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  matchPill: {
    backgroundColor: '#F9EAF0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  matchPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.primary,
  },
  verifiedPill: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  verifiedPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.success,
  },
  actionBtn: {
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  actionBtnSent: {
    backgroundColor: colors.success,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: fontSizes.xs - 1,
    fontWeight: '800',
  },
});
