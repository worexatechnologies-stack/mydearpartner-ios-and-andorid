import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  index?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
  disabled?: boolean;
}

export default function AnimatedCard({
  children,
  index = 0,
  onPress,
  style,
  activeScale = 0.985,
  disabled = false,
}: AnimatedCardProps) {
  const reduced = useReducedMotion();
  const enterProgress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      enterProgress.setValue(1);
      return;
    }

    const delay = Math.min(index * motion.stagger, motion.maxStagger);
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(enterProgress, {
          toValue: 1,
          duration: motion.duration.standard,
          useNativeDriver: true,
        }),
        Animated.spring(pressScale, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
    ]);

    animation.start();
    return () => animation.stop();
  }, [reduced, index, enterProgress, pressScale]);

  const handlePressIn = () => {
    if (disabled || reduced || !onPress) return;
    Animated.spring(pressScale, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 40,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled || reduced || !onPress) return;
    Animated.spring(pressScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
    }).start();
  };

  const translateY = enterProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [motion.distance, 0],
  });

  const animatedStyle = {
    opacity: enterProgress,
    transform: [{ translateY }, { scale: pressScale }],
  };

  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.94}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.touchable}
      >
        <Animated.View style={[style, animatedStyle]}>
          {children}
        </Animated.View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
  },
});
