import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/theme';
import { motion } from '../theme/motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function validProgress(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function useProgress(value: number | null | undefined) {
  const reduced = useReducedMotion();
  const target = validProgress(value);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reduced ? (target ?? 0) : withTiming(target ?? 0, { duration: motion.duration.reveal });
    return () => cancelAnimation(progress);
  }, [progress, reduced, target]);
  return progress;
}

/** The text always shows the actual value, independently of decorative progress. */
export function AnimatedCompatibilityRing({
  score,
  size = 112,
  strokeWidth = 6,
}: {
  score?: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const target = validProgress(score);
  const progress = useProgress(target);
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  const strokeColor =
    target === null
      ? colors.primaryLight
      : target >= 85
      ? '#E9B44C' // Subtle matrimonial gold for exceptional match
      : target >= 70
      ? colors.primary // Warm rose
      : '#E26D8C'; // Soft berry

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={
        target === null
          ? 'Match score unavailable'
          : `Reported match score ${target}%`
      }
      accessibilityValue={
        target === null
          ? { text: 'Not available' }
          : { min: 0, max: 100, now: target }
      }
      style={{ width: size, height: size, alignSelf: 'center' }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(165, 55, 96, 0.12)"
          strokeWidth={strokeWidth}
        />
        {target !== null && (
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={[circumference, circumference]}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
            animatedProps={animatedProps}
          />
        )}
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Text
          style={{
            color: strokeColor,
            fontSize: target === null ? 14 : size > 100 ? 28 : 20,
            fontWeight: '800',
            textAlign: 'center',
          }}
        >
          {target === null ? 'Not available' : `${target}%`}
        </Text>
      </View>
    </View>
  );
}


export function AnimatedProgressBar({ value, color = colors.primary }: { value: number; color?: string }) {
  const progress = useProgress(value);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value / 100 }] }));
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: validProgress(value) ?? 0 }} style={styles.track}>
    <Animated.View style={[styles.fill, { backgroundColor: color }, style]} />
  </View>;
}

/** Mount only after an existing save has been confirmed. */
export function SavedCheckmark() {
  const progress = useProgress(100);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: 32 * (1 - progress.value / 100) }));
  return <Svg width={24} height={24} viewBox="0 0 24 24" accessibilityLabel="Saved">
    <AnimatedPath d="M4 12l5 5L20 6" fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={[32, 32]} animatedProps={animatedProps} />
  </Svg>;
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(165,55,96,0.12)', overflow: 'hidden' },
  fill: { width: '100%', height: '100%', borderRadius: 3, transformOrigin: 'left center' },
});
