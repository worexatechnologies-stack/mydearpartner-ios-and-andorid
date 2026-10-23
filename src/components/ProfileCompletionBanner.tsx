/**
 * MyDearPartner — Profile Completion Banner (U11)
 *
 * Shows a progress bar + call-to-action when the user's profile is <85% complete.
 * Drop it near the top of the Discover or Profile screens.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/AuthContext';
import { fontSizes, radii, spacing } from '../theme/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Field { label: string; key: keyof import('../types/models').Profile; }

const FIELDS: Field[] = [
  { label: 'Name', key: 'name' },
  { label: 'Age', key: 'age' },
  { label: 'City', key: 'city' },
  { label: 'State', key: 'state' },
  { label: 'Religion', key: 'religion' },
  { label: 'Profession', key: 'profession' },
  { label: 'Education', key: 'education' },
  { label: 'Height', key: 'height' },
  { label: 'About', key: 'about' },
  { label: 'Photo', key: 'photo' },
  { label: 'Mother Tongue', key: 'motherTongue' },
  { label: 'Horoscope', key: 'horoscope' },
  { label: 'Marital Status', key: 'maritalStatus' },
  { label: 'Income', key: 'income' },
];

const HIDE_THRESHOLD = 85; // hide banner once ≥85% complete

interface Props {
  onPress?: () => void;
}

export default function ProfileCompletionBanner({ onPress }: Props) {
  const { currentUser } = useAuth();
  const profile = currentUser?.profile;
  const reduced = useReducedMotion();

  const { percent, missing } = useMemo(() => {
    if (!profile) return { percent: 0, missing: [] };
    const done = FIELDS.filter(f => {
      const v = profile[f.key];
      return v !== undefined && v !== null && v !== '' && v !== 0;
    });
    const missingFields = FIELDS.filter(f => {
      const v = profile[f.key];
      return !v || v === '' || v === 0;
    }).map(f => f.label);
    return {
      percent: Math.round((done.length / FIELDS.length) * 100),
      missing: missingFields,
    };
  }, [profile]);

  const animatedProgress = useRef(new Animated.Value(reduced ? percent : 0)).current;

  useEffect(() => {
    if (reduced) {
      animatedProgress.setValue(percent);
      return;
    }
    Animated.spring(animatedProgress, {
      toValue: percent,
      friction: 7,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [percent, reduced, animatedProgress]);

  if (!profile || percent >= HIDE_THRESHOLD) return null;

  const color = percent < 40 ? '#EF4444' : percent < 70 ? '#F59E0B' : '#10B981';

  const widthInterpolation = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={`Profile ${percent}% complete. Tap to improve.`}
    >
      <LinearGradient
        colors={['#1E1B4B', '#312E81']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Icon name="person-circle-outline" size={28} color="#A5B4FC" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.headRow}>
            <Text style={styles.title}>Your profile is {percent}% complete</Text>
            <Text style={styles.pct}>{percent}%</Text>
          </View>
          {/* Progress bar */}
          <View style={styles.track}>
            <Animated.View style={[styles.fill, { width: widthInterpolation, backgroundColor: color }]} />
          </View>
          {missing.length > 0 && (
            <Text style={styles.hint} numberOfLines={1}>
              Add: {missing.slice(0, 3).join(', ')}{missing.length > 3 ? ` +${missing.length - 3} more` : ''}
            </Text>
          )}
        </View>
        <Icon name="chevron-forward" size={16} color="rgba(255,255,255,0.5)" style={{ marginLeft: 8 }} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(99,102,241,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: '#E0E7FF',
    flex: 1,
  },
  pct: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: '#A5B4FC',
    marginLeft: 8,
  },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
    marginBottom: 5,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
  },
});
