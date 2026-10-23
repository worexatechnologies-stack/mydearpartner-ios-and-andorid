import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/theme';

interface AnimatedHeartProps {
  size?: number;
  color?: string;
  pulsing?: boolean;
  beatCount?: number;
}

/**
 * AnimatedHeart: Elegant, gentle matrimonial heart pulse animation.
 * Reusable across Splash, Match Celebrations, and connection interactions.
 */
export default function AnimatedHeart({
  size = 28,
  color = colors.action,
  pulsing = true,
  beatCount,
}: AnimatedHeartProps) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (reducedMotion || !pulsing) {
      scale.setValue(1);
      glow.setValue(0.2);
      return;
    }

    const pulseAnimation = Animated.sequence([
      Animated.parallel([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.6,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.2,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(400),
    ]);

    const loop = beatCount
      ? Animated.loop(pulseAnimation, { iterations: beatCount })
      : Animated.loop(pulseAnimation);

    loop.start();
    return () => loop.stop();
  }, [pulsing, reducedMotion, scale, glow, beatCount]);

  return (
    <View style={[styles.container, { width: size + 16, height: size + 16 }]}>
      <Animated.View
        style={[
          styles.glowCircle,
          {
            width: size + 14,
            height: size + 14,
            borderRadius: (size + 14) / 2,
            backgroundColor: color,
            opacity: glow,
            transform: [{ scale }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name="heart" size={size} color={color} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    position: 'absolute',
  },
});
