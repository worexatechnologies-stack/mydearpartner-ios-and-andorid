import React from 'react';
import { StyleProp,StyleSheet,Text,View,ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors,spacing,typography } from '../theme/theme';
import AppButton from './AppButton';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  buttonText?: string;
  onButtonPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export default function EmptyState({
  icon,
  title,
  description,
  buttonText,
  onButtonPress,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {buttonText && onButtonPress && (
        <AppButton
          title={buttonText}
          onPress={onButtonPress}
          style={styles.button}
        />
      )}
    </View>
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
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  description: {
    fontSize: typography.sizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  button: {
    maxWidth: 320,
  },
});
