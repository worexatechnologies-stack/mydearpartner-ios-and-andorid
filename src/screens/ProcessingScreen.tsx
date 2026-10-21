import React, { useEffect } from 'react';
import { StyleSheet, View, Text, StatusBar } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, spacing } from '../theme/theme';
import { LogoMark } from '../components/LogoMark';

export default function ProcessingScreen({ message = 'Processing...' }: { message?: string }) {

  // Animation values
  const pulseScale = useSharedValue(0.9);
  const pulseOpacity = useSharedValue(0.1);
  const logoRotation = useSharedValue(0);

  useEffect(() => {
    // Pulse effect for the background ring
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.9, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.05, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.15, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Subtle continuous rotation for the logo
    logoRotation.value = withRepeat(
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1,
      false
    );
  }, [logoRotation, pulseOpacity, pulseScale]);

  const ringAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${logoRotation.value}deg` }],
  }));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        {/* Animated Background Ring */}
        <Animated.View style={[styles.pulseRing, ringAnimatedStyle]} />

        {/* Outer Ring */}
        <View style={styles.solidRing}>
          {/* Inner Logo */}
          <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
            <LogoMark size={50} />
          </Animated.View>
        </View>

        {/* Professional Typography */}
        <Text style={styles.message}>
          {message}
        </Text>
        <Text style={styles.subtext}>Please wait a moment</Text>
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
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.primary, // #FF1E66
    top: -20,
  },
  solidRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 4,
  },
  logoContainer: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: '#222222',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '500',
  },
});
