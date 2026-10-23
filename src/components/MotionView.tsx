import React, { useEffect, useRef } from 'react';
import { Animated, Easing, ViewProps } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { motion } from '../theme/motion';

interface Props extends ViewProps {
  index?: number;
  /** Only a meaningful state change should replay a reveal, never a parent render. */
  replayKey?: string | number | boolean;
  emphasis?: boolean;
}

/** Native-driven entrance; children and their actions are available immediately. */
export default function MotionView({ index = 0, replayKey, emphasis = false, style, ...props }: Props) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progress.stopAnimation();
    if (reduced) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.standard,
      delay: Math.min(Math.max(0, index) * motion.stagger, motion.maxStagger),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
    // Index is initial choreography, not a replay trigger when a list reorders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, reduced, replayKey]);
  return <Animated.View {...props} style={[style, {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
    transform: emphasis
      ? [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }]
      : [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [motion.distance, 0] }) }],
  }]} />;
}
