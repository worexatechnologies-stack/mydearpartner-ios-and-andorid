import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export default function ProfileCardSkeleton() {
  const { width, height } = useWindowDimensions();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  const cardWidth = Math.min(width - 32, 420);
  const cardHeight = Math.min(height * 0.72, 600);

  return (
    <View style={[styles.card, { width: cardWidth, height: cardHeight }]}>
      {/* Photo Placeholder */}
      <Animated.View style={[styles.photoSkeleton, { opacity }]}>
        <LinearGradient
          colors={['#E5E7EB', '#D1D5DB', '#E5E7EB']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Info Overlay Placeholder */}
      <View style={styles.infoOverlay}>
        <Animated.View style={[styles.nameSkeleton, { opacity }]} />
        <Animated.View style={[styles.subSkeleton, { opacity }]} />

        {/* Chips Row */}
        <View style={styles.chipsRow}>
          <Animated.View style={[styles.chipSkeleton, { width: 90, opacity }]} />
          <Animated.View style={[styles.chipSkeleton, { width: 70, opacity }]} />
          <Animated.View style={[styles.chipSkeleton, { width: 85, opacity }]} />
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionsRow}>
          <Animated.View style={[styles.circleBtn, { opacity }]} />
          <Animated.View style={[styles.tonalBtn, { opacity }]} />
          <Animated.View style={[styles.solidBtn, { opacity }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    alignSelf: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoSkeleton: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  nameSkeleton: {
    height: 24,
    width: '60%',
    borderRadius: 6,
    backgroundColor: '#CBD5E1',
    marginBottom: 8,
  },
  subSkeleton: {
    height: 14,
    width: '45%',
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chipSkeleton: {
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  tonalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
  },
  solidBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#CBD5E1',
  },
});
