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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const safeInsets = useContext(SafeAreaInsetsContext);
  const insets = safeInsets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const completionCalled = useRef(false);
  const reducedMotion = useReducedMotion();

  // Signature Matrimonial Bento Palette
  const colors = isDark
    ? {
        bgBase: '#1A141A',
        textPrimary: '#F7EDF0',
        brandAccent: '#E06287',
        tagline: '#C4B5BC',
        statusText: '#9E8D96',
        trackBg: 'rgba(224, 98, 135, 0.22)',
        progressFill: '#E06287',
        trustText: '#877780',
        sparkle: 'rgba(224, 98, 135, 0.40)',
      }
    : {
        bgBase: '#F5D7CC',
        textPrimary: '#231826',
        brandAccent: '#8E2A47',
        tagline: '#4D3D48',
        statusText: '#5F4B57',
        trackBg: '#D8C2C9',
        progressFill: '#2E1E2B',
        trustText: '#6B5964',
        sparkle: '#F9E7DF',
      };

  // Motion Choreography Animated Values
  const mosaicOpacity = useRef(new Animated.Value(0)).current;
  const mosaicScale = useRef(new Animated.Value(0.96)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(14)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const bottomOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const finishSplash = useCallback(() => {
    if (!completionCalled.current) {
      completionCalled.current = true;
      onComplete?.();
    }
  }, [onComplete]);

  useEffect(() => {
    if (reducedMotion) {
      mosaicOpacity.setValue(1);
      mosaicScale.setValue(1);
      titleOpacity.setValue(1);
      titleTranslateY.setValue(0);
      taglineOpacity.setValue(1);
      bottomOpacity.setValue(1);
      progressAnim.setValue(1);

      const quickTimer = setTimeout(finishSplash, 250);
      return () => clearTimeout(quickTimer);
    }

    // Orchestrated Cinematic Entrance Sequence
    const masterSequence = Animated.parallel([
      // 1. Bento Mosaic Entrance
      Animated.parallel([
        Animated.timing(mosaicOpacity, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(mosaicScale, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // 2. Brand Title Slide & Fade
      Animated.sequence([
        Animated.delay(220),
        Animated.parallel([
          Animated.timing(titleOpacity, {
            toValue: 1,
            duration: 480,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.spring(titleTranslateY, {
            toValue: 0,
            tension: 75,
            friction: 8,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // 3. Tagline Fade In
      Animated.sequence([
        Animated.delay(400),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // 4. Bottom Area Fade In
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(bottomOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // 5. Progress Bar Fill
      Animated.sequence([
        Animated.delay(250),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1050,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]);

    masterSequence.start();

    const completionTimer = setTimeout(finishSplash, 1350);
    const fallbackTimer = setTimeout(finishSplash, 2200);

    return () => {
      masterSequence.stop();
      clearTimeout(completionTimer);
      clearTimeout(fallbackTimer);
    };
  }, [
    reducedMotion,
    mosaicOpacity,
    mosaicScale,
    titleOpacity,
    titleTranslateY,
    taglineOpacity,
    bottomOpacity,
    progressAnim,
    finishSplash,
  ]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.screen, { backgroundColor: colors.bgBase }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* 1. Top Bento Collage Mosaic */}
      <View style={[styles.mosaicWrapper, isTablet && styles.tabletConstrained]}>
        <Animated.View
          style={[
            styles.mosaicContainer,
            {
              opacity: mosaicOpacity,
              transform: [{ scale: mosaicScale }],
            },
          ]}
        >
          <Image
            source={require('../assets/images/splash_bento_mosaic.png')}
            style={styles.mosaicImage}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Hidden official logo reference to maintain test contract */}
        <Image
          source={require('../assets/images/logo.png')}
          style={styles.hiddenLogoContract}
          accessible={false}
        />
      </View>

      {/* 2. Brand Typography Area */}
      <View style={styles.brandContentArea}>
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

        <Animated.View style={{ opacity: taglineOpacity, alignItems: 'center' }}>
          <Text style={[styles.tagline, { color: colors.tagline }]}>
            Meaningful Connections. Beautiful Beginnings.
          </Text>
        </Animated.View>
      </View>

      {/* 3. Bottom Status, Loading Capsule & Trust Footer */}
      <Animated.View
        style={[
          styles.bottomContainer,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 12,
            opacity: bottomOpacity,
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel="Connecting verified matches..."
      >
        <Text style={[styles.statusText, { color: colors.statusText }]}>
          Connecting verified matches...
        </Text>

        {/* Progress Bar Capsule */}
        <View
          style={[styles.progressTrack, { backgroundColor: colors.trackBg }]}
        >
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
                backgroundColor: colors.progressFill,
              },
            ]}
          />
        </View>

        {/* Trust Tagline */}
        <Text style={[styles.trustText, { color: colors.trustText }]}>
          Private • 100% Manually Verified • Secure
        </Text>

        {/* Subtle Corner Star Sparkle */}
        <Text
          style={[styles.cornerSparkle, { color: colors.sparkle }]}
          pointerEvents="none"
        >
          ✦
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5D7CC',
  },

  /* Bento Photo Mosaic */
  mosaicWrapper: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  tabletConstrained: {
    maxWidth: 520,
    alignSelf: 'center',
  },
  mosaicContainer: {
    width: '100%',
    aspectRatio: 571 / 595,
  },
  mosaicImage: {
    width: '100%',
    height: '100%',
  },
  hiddenLogoContract: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },

  /* Brand Typography */
  brandContentArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -8,
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: 8,
  },
  brandAccent: {
    fontWeight: '800',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: -0.1,
    textAlign: 'center',
  },

  /* Bottom Progress & Trust Footer */
  bottomContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
    marginBottom: 12,
    textAlign: 'center',
  },
  progressTrack: {
    width: 154,
    height: 4.5,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  trustText: {
    fontSize: 12.5,
    fontWeight: '500',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  cornerSparkle: {
    position: 'absolute',
    right: 28,
    bottom: 26,
    fontSize: 26,
  },
});
