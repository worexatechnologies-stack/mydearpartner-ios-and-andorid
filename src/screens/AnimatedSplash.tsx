import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Platform, Animated as RNAnimated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import BootSplash from 'react-native-bootsplash';
import { tokens } from '../theme/tokens';
import { LogoMark } from '../components/LogoMark';

interface Props {
  navigation: any;
}

export const AnimatedSplash = ({ navigation }: Props) => {
  // Reanimated values
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const ringsRotation = useSharedValue(-15);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);

  // Classic RN Animated for repeating loading dots
  const dot1Opacity = useRef(new RNAnimated.Value(0)).current;
  const dot2Opacity = useRef(new RNAnimated.Value(0)).current;
  const dot3Opacity = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    // Hide bootsplash once the JS screen takes over
    BootSplash.hide({ fade: false });

    // Orchestrate main animation
    logoOpacity.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) });
    logoScale.value = withSpring(1, { damping: 12, stiffness: 90 });
    
    ringsRotation.value = withDelay(
      300,
      withTiming(0, { duration: 800, easing: Easing.out(Easing.quad) })
    );

    textOpacity.value = withDelay(
      600,
      withTiming(1, { duration: 600 })
    );
    textTranslateY.value = withDelay(
      600,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) })
    );

    // Navigate to next screen after 1.4s (min display + animation)
    const navigationTimer = setTimeout(() => {
      navigation.replace('Main'); // Or 'Login' depending on auth state
    }, 1800);

    // Dot loading animation
    const dotAnim = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(dot1Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(dot2Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.timing(dot3Opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        RNAnimated.delay(300),
        RNAnimated.parallel([
          RNAnimated.timing(dot1Opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(dot2Opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          RNAnimated.timing(dot3Opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ])
    );
    dotAnim.start();

    return () => {
      clearTimeout(navigationTimer);
      dotAnim.stop();
      [logoOpacity, logoScale, ringsRotation, textOpacity, textTranslateY].forEach(cancelAnimation);
    };
  }, [navigation, dot1Opacity, dot2Opacity, dot3Opacity, logoOpacity, logoScale, ringsRotation, textOpacity, textTranslateY]);

  const logoAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: logoOpacity.value,
      transform: [{ scale: logoScale.value }],
    };
  });

  const ringsAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${ringsRotation.value}deg` }],
    };
  });

  const textAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: textOpacity.value,
      transform: [{ translateY: textTranslateY.value }],
    };
  });

  const logoSize = Platform.OS === 'ios' ? 150 : 168;
  const logoRadius = Platform.OS === 'ios' ? 44 : logoSize / 2;

  return (
    <View style={styles.container}>
      {/* Background Gradient */}
      <LinearGradient
        colors={[tokens.colors.bgTop, tokens.colors.bgMid, tokens.colors.bgBottom]}
        style={StyleSheet.absoluteFill}
      />

      {/* Faint Concentric Circles */}
      <View style={styles.circlesContainer}>
        <View style={[styles.circle, { width: 300, height: 300, borderRadius: 150, opacity: 0.07 }]} />
        <View style={[styles.circle, { width: 450, height: 450, borderRadius: 225, opacity: 0.06 }]} />
        <View style={[styles.circle, { width: 600, height: 600, borderRadius: 300, opacity: 0.05 }]} />
        <View style={[styles.circle, { width: 750, height: 750, borderRadius: 375, opacity: 0.04 }]} />
      </View>
      
      {/* Soft Rose Glow */}
      <View style={styles.glow} />

      <View style={styles.content}>
        {/* Animated Logo */}
        <Animated.View style={[styles.logoBadge, { width: logoSize, height: logoSize, borderRadius: logoRadius }, logoAnimatedStyle]}>
          <LinearGradient
            colors={['#4A1230', '#2A0C1E']}
            style={[StyleSheet.absoluteFill, { borderRadius: logoRadius }]}
          />
          <View style={[styles.logoBorder, { borderRadius: logoRadius }]} />
          
          <Animated.View style={ringsAnimatedStyle}>
            <LogoMark size={90} />
          </Animated.View>
        </Animated.View>

        {/* Animated Text */}
        <Animated.View style={[styles.textContainer, textAnimatedStyle]}>
          <Text style={styles.title}>My Dear Partner</Text>
          <Text style={styles.tagline}>Your next chapter begins here</Text>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          <RNAnimated.View style={[styles.dot, styles.dotRose, { opacity: dot1Opacity }]} />
          <RNAnimated.View style={[styles.dot, { opacity: dot2Opacity }]} />
          <RNAnimated.View style={[styles.dot, { opacity: dot3Opacity }]} />
        </View>

        {Platform.OS === 'android' && (
          <Text style={styles.footerText}>from Worexa Technologies</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.bgBottom,
  },
  circlesContainer: {
    ...StyleSheet.absoluteFill as any,
    alignItems: 'center',
    justifyContent: 'center',
    top: '-8%', // Roughly 46% height center visually
  },
  circle: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  glow: {
    position: 'absolute',
    top: '35%',
    alignSelf: 'center',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: tokens.colors.rose,
    opacity: 0.15,
    transform: [{ scale: 2 }],
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  logoBorder: {
    ...StyleSheet.absoluteFill as any,
    borderWidth: 1,
    borderColor: tokens.colors.glassBorder,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  title: {
    ...tokens.typography.wordmark,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  tagline: {
    ...tokens.typography.tab,
    color: tokens.colors.pinkText,
    fontSize: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  dotRose: {
    width: 16,
    backgroundColor: tokens.colors.rose,
  },
  footerText: {
    ...tokens.typography.chip,
    color: '#FFFFFF',
    opacity: 0.45,
  },
});
