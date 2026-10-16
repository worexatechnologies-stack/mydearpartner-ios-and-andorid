import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  StatusBar,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { LogoMark } from '../components/LogoMark';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const completionCalled = useRef(false);
  const reducedMotion = useReducedMotion();

  // All animation values (standard RN Animated — Jest-safe, no infinite loops)
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;

  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(10)).current;

  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  const progressBar = useRef(new Animated.Value(0)).current;

  const finishSplash = () => {
    if (!completionCalled.current) {
      completionCalled.current = true;
      onComplete?.();
    }
  };

  useEffect(() => {
    if (reducedMotion) {
      logoOpacity.setValue(1);
      logoScale.setValue(1);
      textOpacity.setValue(1);
      textTranslateY.setValue(0);
      subtitleOpacity.setValue(1);
      progressBar.setValue(1);
      const t = setTimeout(finishSplash, 400);
      return () => clearTimeout(t);
    }

    // ── Orchestrated 3-stage animation (all finite, no loops) ──────────────
    const seq = Animated.parallel([
      // Stage 1 — Logo springs in (0 → 0.9 s)
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 80,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),

      // Stage 2 — Brand name slides up (0.5 → 1.2 s)
      Animated.sequence([
        Animated.delay(500),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 550,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(textTranslateY, {
            toValue: 0,
            tension: 80,
            friction: 7,
            useNativeDriver: true,
          }),
        ]),
      ]),

      // Stage 3 — Subtitle fades in (0.9 → 1.5 s)
      Animated.sequence([
        Animated.delay(900),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // Stage 4 — Progress bar fills (0.3 → 3.2 s)
      Animated.sequence([
        Animated.delay(300),
        Animated.timing(progressBar, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    ]);

    seq.start(({ finished }) => {
      if (finished) finishSplash();
    });

    const fallback = setTimeout(finishSplash, 3600);
    return () => {
      seq.stop();
      clearTimeout(fallback);
    };
  }, [
    reducedMotion,
    logoOpacity,
    logoScale,
    textOpacity,
    textTranslateY,
    subtitleOpacity,
    progressBar,
  ]);

  const barTrackWidth = Math.min(width * 0.72, 280);
  const fillWidth = progressBar.interpolate({
    inputRange: [0, 1],
    outputRange: [0, barTrackWidth],
  });

  return (
    <View style={styles.screen}>
      <StatusBar
        barStyle="dark-content"
        {...(Platform.OS === 'android' ? ({ backgroundColor: '#FFFFFF' } as any) : {})}
      />

      {/* Center Brand Group */}
      <View style={styles.centerContainer}>

        {/* dp Monogram Logo */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LogoMark size={130} />
        </Animated.View>

        {/* MyDearPartner wordmark */}
        <Animated.View
          style={[
            styles.brandRow,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.brandTitle}>
            {'MyDear'}
            <Text style={styles.brandPartner}>{'Partner'}</Text>
          </Text>
        </Animated.View>

        {/* TRUSTED MATCHMAKING */}
        <Animated.Text
          style={[styles.subtitle, { opacity: subtitleOpacity }]}
        >
          {'TRUSTED MATCHMAKING'}
        </Animated.Text>
      </View>

      {/* Bottom progress bar */}
      <View style={[styles.progressTrack, { width: barTrackWidth }]}>
        <Animated.View style={[styles.progressFill, { width: fillWidth }]}>
          <LinearGradient
            colors={['#C41048', '#E8527A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
    // Subtle drop-shadow to lift the logo
    shadowColor: '#C41048',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 3,
  },
  brandRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  brandTitle: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontSize: 34,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  brandPartner: {
    color: '#C41048',
  },
  subtitle: {
    fontSize: 11,
    letterSpacing: 3.5,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  // Progress bar sits near the very bottom of the screen
  progressTrack: {
    position: 'absolute',
    bottom: 52,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F3E4E9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
});
