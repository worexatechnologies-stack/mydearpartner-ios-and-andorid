import React, { useEffect } from 'react';
import { StyleSheet, View, Text, StatusBar, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/theme';

interface Props {
  onRetry: () => void;
  error?: string;
}

export default function ConnectionErrorScreen({ onRetry, error }: Props) {
  const insets = useSafeAreaInsets();

  // Animation values
  const floatY = useSharedValue(0);
  const glowScale = useSharedValue(0.9);
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(20);

  useEffect(() => {
    // Floating effect for the icon
    floatY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(8, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Pulsing background glow
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Content entry animation
    contentOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 800 })
    );
    contentTranslateY.value = withDelay(
      300,
      withSpring(0, { damping: 15 })
    );
  }, []);

  const floatingIconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.iconWrapper}>
          <Animated.View style={[styles.glow, glowStyle]} />
          
          <Animated.View style={[styles.card, floatingIconStyle]}>
            <Icon name="cloud-offline-outline" size={42} color={colors.primary} />
          </Animated.View>
        </View>

        <Text style={styles.title}>Connection Lost</Text>
        <Text style={styles.description}>
          {error || 'The connection to our servers was interrupted. Please check your network and try again.'}
        </Text>

        {/* Solid Professional Retry Button */}
        <Pressable
          accessibilityRole="button"
          onPress={onRetry}
          style={({ pressed }) => [
            styles.primaryBtnWrap,
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <View style={styles.primaryBtn}>
            <Icon name="refresh" size={18} color="#FFFFFF" style={styles.btnIcon} />
            <Text style={styles.primaryBtnText}>Reconnect</Text>
          </View>
        </Pressable>
      </Animated.View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Text style={styles.footerText}>MyDearPartner</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    width: '100%',
    maxWidth: 500,
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    height: 100,
    width: 100,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  card: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#222222',
    marginBottom: spacing.sm,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: spacing.sm,
  },
  primaryBtnWrap: {
    width: '100%',
    borderRadius: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  btnIcon: {
    marginRight: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#BBBBBB',
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
