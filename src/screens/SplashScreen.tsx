import React, { useCallback, useEffect, useRef, useContext } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  StatusBar,
  Animated,
  Easing,
  useColorScheme,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const safeInsets = useContext(SafeAreaInsetsContext);
  const insets = safeInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const completionCalled = useRef(false);
  const reducedMotion = useReducedMotion();

  // 2026 Ultra-Luxury Palette (Modern Berry, Warm Rose & Champagne Ambient)
  const colors = isDark
    ? {
        bgBase: '#0F0C10',
        bgGradientStart: '#140F16',
        bgGradientEnd: '#0A080C',
        textPrimary: '#FBF9FA',
        brandAccent: '#E26D8C',
        shimmerLight: '#FCE7F3',
        tagline: '#B8A8B2',
        statusText: '#A1919C',
        trustText: '#8E7E89',
        hairline: 'rgba(226, 109, 140, 0.20)',
        trackBg: 'rgba(226, 109, 140, 0.15)',
        badgeBg: 'rgba(226, 109, 140, 0.08)',
        badgeBorder: 'rgba(226, 109, 140, 0.22)',
        orb1: 'rgba(226, 109, 140, 0.14)',
        orb2: 'rgba(158, 49, 82, 0.12)',
        orbCenter: 'rgba(226, 109, 140, 0.09)',
        ring1: 'rgba(226, 109, 140, 0.16)',
        ring2: 'rgba(226, 109, 140, 0.09)',
        ring3: 'rgba(226, 109, 140, 0.04)',
        discBg: '#1B141D',
        discBorder: 'rgba(226, 109, 140, 0.24)',
        discInnerGlow: 'rgba(255, 255, 255, 0.05)',
        shadow: '#E26D8C',
      }
    : {
        bgBase: '#FAF8F7',
        bgGradientStart: '#FAF8F7',
        bgGradientEnd: '#F4ECEF',
        textPrimary: '#1E1622',
        brandAccent: '#9E3152',
        shimmerLight: '#FBCFE8',
        tagline: '#6C5D66',
        statusText: '#877681',
        trustText: '#9A8A94',
        hairline: 'rgba(158, 49, 82, 0.16)',
        trackBg: 'rgba(158, 49, 82, 0.09)',
        badgeBg: 'rgba(158, 49, 82, 0.05)',
        badgeBorder: 'rgba(158, 49, 82, 0.15)',
        orb1: 'rgba(232, 164, 184, 0.28)',
        orb2: 'rgba(247, 214, 224, 0.32)',
        orbCenter: 'rgba(158, 49, 82, 0.06)',
        ring1: 'rgba(158, 49, 82, 0.12)',
        ring2: 'rgba(158, 49, 82, 0.07)',
        ring3: 'rgba(158, 49, 82, 0.03)',
        discBg: '#FFFFFF',
        discBorder: 'rgba(158, 49, 82, 0.10)',
        discInnerGlow: 'rgba(255, 255, 255, 0.95)',
        shadow: '#9E3152',
      };

  // Motion Choreography Animated Values (Native GPU Accelerated)
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const orbsScale = useRef(new Animated.Value(0.9)).current;
  const ringsScale = useRef(new Animated.Value(0.85)).current;
  const ringsOpacity = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const badgeTranslateY = useRef(new Animated.Value(-8)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const sparklePulse = useRef(new Animated.Value(0.25)).current;
  const shimmerTranslateX = useRef(new Animated.Value(-70)).current;

  const finishSplash = useCallback(() => {
    if (!completionCalled.current) {
      completionCalled.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    if (reducedMotion) {
      bgOpacity.setValue(1);
      orbsScale.setValue(1);
      ringsScale.setValue(1);
      ringsOpacity.setValue(1);
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      badgeOpacity.setValue(1);
      badgeTranslateY.setValue(0);
      titleOpacity.setValue(1);
      titleTranslateY.setValue(0);
      taglineOpacity.setValue(1);
      bottomOpacity.setValue(1);
      shimmerTranslateX.setValue(150);
      const timer = setTimeout(finishSplash, 250);
      return () => clearTimeout(timer);
    }

    // Orchestrated Cinematic Entrance Sequence
    const masterSequence = Animated.parallel([
      // Stage 1: Ambient background & luminous orbs bloom (0 - 300ms)
      Animated.timing(bgOpacity, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(orbsScale, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),

      // Stage 2: Concentric Auric Rings expand (150ms - 750ms)
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(ringsOpacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(ringsScale, {
            toValue: 1,
            duration: 750,
            easing: Easing.out(Easing.back(1.1)),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 3: Glassmorphic Emblem reveals with spring physics (200ms - 650ms)
      Animated.sequence([
        Animated.delay(200),
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 450,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(logoScale, {
            toValue: 1,
            tension: 72,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 4: Curated micro-badge drops in gently (400ms - 750ms)
      Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(badgeOpacity, {
            toValue: 1,
            duration: 350,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(badgeTranslateY, {
            toValue: 0,
            duration: 350,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 5: App Name fades & rises into place (500ms - 850ms)
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 400,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(titleTranslateY, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 6: Tagline & Star divider glide in (650ms - 1000ms)
      Animated.sequence([
        Animated.delay(650),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // Stage 7: Bottom Progress & Trust Footer illuminate (750ms+)
      Animated.sequence([
        Animated.delay(750),
        Animated.timing(bottomOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]),
    ]);

    // Micro sparkle ambient twinkle loop (finite iterations for Jest safety)
    const sparkleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(sparklePulse, {
          toValue: 0.85,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sparklePulse, {
          toValue: 0.25,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 4 },
    );

    // Dynamic laser shimmer beam across progress capsule
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerTranslateX, {
          toValue: 160,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerTranslateX, {
          toValue: -70,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 4 },
    );

    masterSequence.start();
    sparkleAnimation.start();
    shimmerAnimation.start();

    // Natural cinematic exit transition
    const completionTimer = setTimeout(finishSplash, 1350);
    const fallbackTimer = setTimeout(finishSplash, 2200);

    return () => {
      masterSequence.stop();
      sparkleAnimation.stop();
      shimmerAnimation.stop();
      clearTimeout(completionTimer);
      clearTimeout(fallbackTimer);
    };
  }, [
    reducedMotion,
    bgOpacity,
    orbsScale,
    ringsScale,
    ringsOpacity,
    logoOpacity,
    logoScale,
    badgeOpacity,
    badgeTranslateY,
    titleOpacity,
    titleTranslateY,
    taglineOpacity,
    bottomOpacity,
    sparklePulse,
    shimmerTranslateX,
    finishSplash,
  ]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. Ambient Radiant Atmosphere (Top-Right & Bottom-Left Orbs) */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: bgOpacity }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={[colors.bgGradientStart, colors.bgGradientEnd]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Top-Right Soft Radiant Aura */}
        <Animated.View
          style={[
            styles.ambientOrbTop,
            {
              backgroundColor: colors.orb1,
              transform: [{ scale: orbsScale }],
            },
          ]}
        />

        {/* Bottom-Left Soft Radiant Aura */}
        <Animated.View
          style={[
            styles.ambientOrbBottom,
            {
              backgroundColor: colors.orb2,
              transform: [{ scale: orbsScale }],
            },
          ]}
        />

        {/* Ambient Celestial Micro-Sparkles */}
        <Animated.Text
          style={[
            styles.floatingSparkle1,
            { color: colors.brandAccent, opacity: sparklePulse },
          ]}
        >
          ✦
        </Animated.Text>
        <Animated.Text
          style={[
            styles.floatingSparkle2,
            { color: colors.brandAccent, opacity: sparklePulse },
          ]}
        >
          ✦
        </Animated.Text>
        <Animated.Text
          style={[
            styles.floatingSparkle3,
            { color: colors.brandAccent, opacity: sparklePulse },
          ]}
        >
          ✦
        </Animated.Text>
      </Animated.View>

      {/* 2. Centerpiece: Luxury Emblem & Brand Typography */}
      <View style={styles.centerContainer}>
        {/* Luminous Center Aura Bloom */}
        <Animated.View
          style={[
            styles.centerGlowBloom,
            {
              backgroundColor: colors.orbCenter,
              opacity: logoOpacity,
              transform: [{ scale: ringsScale }],
            },
          ]}
        />

        {/* Concentric Heartbeat Auric Rings */}
        <Animated.View
          style={[
            styles.concentricRing,
            styles.ringOuter,
            {
              borderColor: colors.ring3,
              opacity: ringsOpacity,
              transform: [{ scale: ringsScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.concentricRing,
            styles.ringMid,
            {
              borderColor: colors.ring2,
              opacity: ringsOpacity,
              transform: [{ scale: ringsScale }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.concentricRing,
            styles.ringInner,
            {
              borderColor: colors.ring1,
              opacity: ringsOpacity,
              transform: [{ scale: ringsScale }],
            },
          ]}
        />

        {/* Glassmorphic Emblem */}
        <Animated.View
          style={[
            styles.logoShadowWrapper,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View
            style={[
              styles.logoDisc,
              {
                backgroundColor: colors.discBg,
                borderColor: colors.discBorder,
              },
            ]}
          >
            {/* Subtle frosted glass specular inner border */}
            <View
              style={[
                styles.discSpecularRim,
                { borderColor: colors.discInnerGlow },
              ]}
            />
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        {/* Micro-Curated Status Pill */}
        <Animated.View
          style={[
            styles.curatedBadge,
            {
              backgroundColor: colors.badgeBg,
              borderColor: colors.badgeBorder,
              opacity: badgeOpacity,
              transform: [{ translateY: badgeTranslateY }],
            },
          ]}
        >
          <Text style={[styles.curatedBadgeText, { color: colors.brandAccent }]}>
            ✦ VERIFIED MATCHMAKING ✦
          </Text>
        </Animated.View>

        {/* Brand Title: Modern Editorial Typography */}
        <Animated.View
          style={{
            opacity: titleOpacity,
            transform: [{ translateY: titleTranslateY }],
            alignItems: 'center',
          }}
        >
          <Text style={[styles.brandTitle, { color: colors.textPrimary }]}>
            {'My Dear '}
            <Text style={[styles.brandAccent, { color: colors.brandAccent }]}>
              {'Partner'}
            </Text>
          </Text>
        </Animated.View>

        {/* Elegant Star Divider & Tagline */}
        <Animated.View
          style={[styles.taglineSection, { opacity: taglineOpacity }]}
        >
          <View style={styles.taglineDividerRow}>
            <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
            <Text style={[styles.sparkleIcon, { color: colors.brandAccent }]}>
              ✦
            </Text>
            <View style={[styles.hairline, { backgroundColor: colors.hairline }]} />
          </View>

          <Text style={[styles.tagline, { color: colors.tagline }]}>
            Meaningful Connections. Beautiful Beginnings.
          </Text>
        </Animated.View>
      </View>

      {/* 3. Bottom Area: Futuristic Shimmer Capsule & Trust Footer */}
      <Animated.View
        style={[
          styles.bottomContainer,
          {
            paddingBottom: Math.max(insets.bottom, 24) + 12,
            opacity: bottomOpacity,
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel="Loading My Dear Partner"
      >
        <Text style={[styles.statusText, { color: colors.statusText }]}>
          Connecting verified matches...
        </Text>

        {/* Futuristic Laser Shimmer Capsule */}
        <View
          style={[styles.capsuleTrack, { backgroundColor: colors.trackBg }]}
        >
          <Animated.View
            style={[
              styles.shimmerBeam,
              {
                transform: [{ translateX: shimmerTranslateX }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                'transparent',
                colors.brandAccent,
                colors.shimmerLight,
                colors.brandAccent,
                'transparent',
              ]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* Discreet Luxury Trust Indicator */}
        <View style={styles.trustBadge}>
          <Text style={[styles.trustText, { color: colors.trustText }]}>
            Private • 100% Manually Verified • Secure
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Ambient Light Atmospheric Orbs */
  ambientOrbTop: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 340,
    height: 340,
    borderRadius: 170,
  },
  floatingSparkle1: {
    position: 'absolute',
    top: '20%',
    left: '12%',
    fontSize: 14,
  },
  floatingSparkle2: {
    position: 'absolute',
    top: '28%',
    right: '14%',
    fontSize: 11,
  },
  floatingSparkle3: {
    position: 'absolute',
    top: '64%',
    left: '15%',
    fontSize: 12,
  },

  /* Centerpiece Group */
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    zIndex: 10,
  },
  centerGlowBloom: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
  },

  /* Concentric Auric Ripple Rings */
  concentricRing: {
    position: 'absolute',
    borderRadius: 999,
  },
  ringOuter: {
    width: 250,
    height: 250,
    borderWidth: 0.75,
  },
  ringMid: {
    width: 200,
    height: 200,
    borderWidth: 1,
  },
  ringInner: {
    width: 154,
    height: 154,
    borderWidth: 1.5,
  },

  /* Glassmorphic Emblem */
  logoShadowWrapper: {
    marginBottom: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  logoDisc: {
    width: 108,
    height: 108,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  discSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 30,
    borderWidth: 1,
    margin: 1.5,
  },
  logoImage: {
    width: 70,
    height: 62,
  },

  /* Curated Micro-Pill */
  curatedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 12,
  },
  curatedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.8,
  },

  /* Brand Typography */
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  brandAccent: {
    fontWeight: '800',
  },

  /* Tagline & Star Accents */
  taglineSection: {
    alignItems: 'center',
    marginTop: 10,
  },
  taglineDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
    width: 180,
  },
  hairline: {
    flex: 1,
    height: 1,
  },
  sparkleIcon: {
    fontSize: 10,
  },
  tagline: {
    fontSize: 13.5,
    fontWeight: '500',
    letterSpacing: 0.35,
    textAlign: 'center',
  },

  /* Bottom Futuristic Loader */
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  capsuleTrack: {
    width: 140,
    height: 3.5,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmerBeam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 70,
  },
  trustBadge: {
    marginTop: 10,
    paddingHorizontal: 12,
  },
  trustText: {
    fontSize: 10.5,
    fontWeight: '500',
    letterSpacing: 0.4,
  },
});
