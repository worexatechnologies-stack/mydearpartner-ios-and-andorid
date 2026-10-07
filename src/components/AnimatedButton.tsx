import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { interaction } from '../theme/theme';
import { useReducedMotion } from '../hooks/useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface AnimatedButtonProps
  extends Omit<PressableProps, 'style' | 'children'> {
  children?:
    | React.ReactNode
    | ((state: { pressed: boolean }) => React.ReactNode);
  style?: StyleProp<ViewStyle>;
  activeScale?: number;
}

export default function AnimatedButton({
  children,
  style,
  activeScale = 0.95,
  disabled = false,
  onPressIn,
  onPressOut,
  ...rest
}: AnimatedButtonProps) {
  const reducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn: NonNullable<PressableProps['onPressIn']> = e => {
    if (disabled || reducedMotion) {
      onPressIn?.(e);
      return;
    }
    Animated.spring(scaleAnim, {
      toValue: activeScale,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut: NonNullable<PressableProps['onPressOut']> = e => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 5,
    }).start();
    if (onPressOut) onPressOut(e);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={interaction.hitSlop}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        style,
        { transform: [{ scale: scaleAnim }] },
        disabled && { opacity: 0.55 },
      ]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
