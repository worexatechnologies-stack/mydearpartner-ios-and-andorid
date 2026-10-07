import BufferingIndicator from './BufferingIndicator';
import React,{ useRef } from 'react';
import {

Animated,
Platform,
Pressable,
StyleProp,
StyleSheet,
Text,
TextStyle,
View,
ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors,radii,spacing } from '../theme/theme';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'text';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
}

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  contentStyle,
  textStyle,
  icon,
}: AppButtonProps) {
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isText = variant === 'text' || variant === 'ghost';

  const reducedMotion = useReducedMotion();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (isDisabled || reducedMotion) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  };

  const renderContent = () => {
    if (loading) {
      return (
        <BufferingIndicator
          size="small"
          color={
            isPrimary
              ? '#FFFFFF'
              : isSecondary
              ? colors.primary
              : colors.primary
          }
        />
      );
    }

    return (
      <View style={styles.contentRow}>
        {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
        <Text
          style={[
            styles.label,
            isPrimary && styles.labelPrimary,
            isSecondary && styles.labelSecondary,
            isOutline && styles.labelOutline,
            isText && styles.labelText,
            isDisabled && isPrimary && styles.labelDisabled,
            textStyle,
          ]}
        >
          {title}
        </Text>
      </View>
    );
  };

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        isPrimary && !isDisabled && styles.shadowContainer,
        isText && styles.textOuter,
        style,
        { transform: [{ scale: scaleAnim }] },
        isDisabled && { opacity: 0.65 },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        style={[
          styles.pressable,
          isSecondary && styles.secondaryPressable,
          isOutline && styles.outlinePressable,
          isText && styles.textPressable,
        ]}
      >
        {isPrimary ? (
          <View style={[styles.solidContent, contentStyle]}>
            <LinearGradient
              pointerEvents="none"
              colors={
                isDisabled ? ['#D1D5DB', '#9CA3AF'] : colors.gradientPrimary
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {renderContent()}
          </View>
        ) : (
          <View
            style={[
              styles.solidContent,
              isText && styles.textSolidContent,
              contentStyle,
            ]}
          >
            {renderContent()}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    width: '100%',
    minHeight: 56,
    borderRadius: radii.md,
  },
  textOuter: {
    height: 'auto',
    minHeight: 44,
  },
  shadowContainer: {
    backgroundColor: colors.primary, // Matches gradient dominant color to avoid white leaks
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  pressable: {
    width: '100%',
    minHeight: 56,
    borderRadius: radii.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  secondaryPressable: {
    backgroundColor: colors.primaryLight,
  },
  outlinePressable: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  textPressable: {
    backgroundColor: 'transparent',
    height: 'auto',
    minHeight: 44,
  },
  solidContent: {
    width: '100%',
    minHeight: 56,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  textSolidContent: {
    height: undefined,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  contentRow: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  label: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  labelPrimary: {
    color: '#FFFFFF',
  },
  labelSecondary: {
    color: colors.primary,
  },
  labelOutline: {
    color: colors.text,
  },
  labelText: {
    color: colors.primary,
  },
  labelDisabled: {
    color: '#FFFFFF',
  },
});
