import React,{ useState } from 'react';
import {
Platform,
Pressable,
StyleProp,
StyleSheet,
Text,
TextInput,
TextInputProps,
View,
ViewStyle,
} from 'react-native';
import { colors,radii,spacing,typeScale,typography } from '../theme/theme';

interface AppTextInputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export default function AppTextInput({
  label,
  error,
  style,
  containerStyle,
  leftElement,
  rightElement,
  onFocus,
  onBlur,
  ...rest
}: AppTextInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = React.useRef<React.ComponentRef<typeof TextInput>>(null);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? (
        <Text
          style={[
            styles.label,
            isFocused && styles.labelFocused,
            error ? styles.labelError : null,
          ]}
        >
          {label}
        </Text>
      ) : null}
      <Pressable
          style={[
          styles.inputContainer,
          rest.multiline && styles.multilineContainer,
          isFocused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
        onPress={() => inputRef.current?.focus()}
      >
        {leftElement && (
          <View style={styles.leftElementContainer}>{leftElement}</View>
        )}
        <TextInput
          ref={inputRef}
          style={[styles.input, rest.multiline && styles.multilineInput, style]}
          placeholderTextColor={colors.textTertiary}
          accessibilityLabel={label ?? rest.placeholder}
          onFocus={e => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement && (
          <View style={styles.rightElementContainer}>{rightElement}</View>
        )}
      </Pressable>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typeScale.subtitle,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  labelFocused: {
    color: colors.primary,
  },
  labelError: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputFocused: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  inputError: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
    padding: 0,
    ...Platform.select({
      android: { includeFontPadding: false },
    }),
  },
  multilineContainer: {
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  leftElementContainer: {
    marginRight: spacing.sm,
    justifyContent: 'center',
  },
  rightElementContainer: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
  },
});
