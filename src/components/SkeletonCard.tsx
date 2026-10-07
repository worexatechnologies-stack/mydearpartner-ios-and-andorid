import { useReducedMotion } from '../hooks/useReducedMotion';
/**
 * MyDearPartner — Skeleton Card
 *
 * Animated loading placeholder that mimics a ProfileCard's layout.
 * Use as ListEmptyComponent while isLoading=true to avoid blank screens.
 */
import React,{ useEffect,useRef } from 'react';
import { Animated,Platform,StyleSheet,View } from 'react-native';
import { colors,radii,spacing } from '../theme/theme';

function Shimmer({ style }: { style?: object }) {
  const reducedMotion = useReducedMotion();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) { anim.setValue(1); return; }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [anim, reducedMotion]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });
  return <Animated.View style={[{ opacity }, style]} />;
}

export default function SkeletonCard() {
  return (
    <View style={styles.card}>
      {/* Photo placeholder */}
      <Shimmer style={styles.photo} />

      {/* Bottom content bar */}
      <View style={styles.content}>
        <Shimmer style={styles.nameLine} />
        <Shimmer style={styles.subLine} />
        <View style={styles.tagRow}>
          <Shimmer style={styles.tag} />
          <Shimmer style={[styles.tag, { width: 70 }]} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </>
  );
}

const SHIMMER_BG = colors.divider || '#E5E7EB';

const styles = StyleSheet.create({
  card: {
    width: '100%',
    marginBottom: spacing.lg,
    borderRadius: radii.xxl ?? 24,
    overflow: 'hidden',
    backgroundColor: SHIMMER_BG,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 4 },
    }),
  },
  photo: {
    width: '100%',
    height: 380,
    backgroundColor: SHIMMER_BG,
  },
  content: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  nameLine: {
    height: 22,
    width: '55%',
    borderRadius: 8,
    backgroundColor: SHIMMER_BG,
    marginBottom: 10,
  },
  subLine: {
    height: 14,
    width: '40%',
    borderRadius: 6,
    backgroundColor: SHIMMER_BG,
    marginBottom: 14,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    height: 28,
    width: 90,
    borderRadius: 100,
    backgroundColor: SHIMMER_BG,
  },
});
