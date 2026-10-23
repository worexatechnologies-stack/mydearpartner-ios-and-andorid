import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors, spacing, typography } from '../theme/theme';
import AppButton from './AppButton';

interface AnimatedEmptyStateProps {
  icon: string;
  title: string;
  description: string;
  buttonText?: string;
  onButtonPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function AnimatedEmptyState({
  icon,
  title,
  description,
  buttonText,
  onButtonPress,
  style,
}: AnimatedEmptyStateProps) {
  const reduced = useReducedMotion();
  const enterScale = useRef(new Animated.Value(reduced ? 1 : 0.92)).current;
  const enterOpacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) {
      enterScale.setValue(1);
      enterOpacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(enterScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(enterOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    // Gentle floating icon micro-animation (finite for testing predictability)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 6 },
    );

    floatLoop.start();
    return () => floatLoop.stop();
  }, [reduced, enterScale, enterOpacity, floatAnim]);

  return (
    <Animated.View
      style={[
        styles.container,
        style,
        {
          opacity: enterOpacity,
          transform: [{ scale: enterScale }],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          { transform: [{ translateY: floatAnim }] },
        ]}
      >
        <Icon name={icon} size={36} color={colors.primary} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {buttonText && onButtonPress && (
        <AppButton
          title={buttonText}
          onPress={onButtonPress}
          style={styles.button}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  button: {
    minWidth: 180,
  },
});
