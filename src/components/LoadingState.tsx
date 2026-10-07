import BufferingIndicator from './BufferingIndicator';
import React from 'react';
import {

StyleProp,
StyleSheet,
Text,
View,
ViewStyle,
} from 'react-native';
import { colors,spacing } from '../theme/theme';

interface LoadingStateProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

/** A consistent, accessible full-area loading treatment for lists and screens. */
export default function LoadingState({
  label = 'Loading…',
  style,
}: LoadingStateProps) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <BufferingIndicator color={colors.primary} size="large" showBar />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
  },
  label: { color: colors.textSecondary, fontSize: 14, fontWeight: '500' },
});
