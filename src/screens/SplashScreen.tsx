import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  StatusBar,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '../components/LogoMark';
import { colors } from '../theme/theme';

interface Props {
  onComplete?: () => void;
}

export default function SplashScreen({ onComplete }: Props) {
  const { width } = useWindowDimensions();
  const completionCalled = useRef(false);

  // Animation values
  const logoOpacity = useSharedValue(0);
  const logoTranslateY = useSharedValue(20);
  
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(10);
  
  const barWidth = useSharedValue(0);

  const finishSplash = () => {
    if (!completionCalled.current && onComplete) {
      completionCalled.current = true;
      onComplete();
    }
  };

  useEffect(() => {
    // 1. Logo Reveal (Fade in and slide up slightly)
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    logoTranslateY.value = withSpring(0, { damping: 15, stiffness: 100 });

    // 2. Text Reveal
    textOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) })
    );
    textTranslateY.value = withDelay(
      400,
      withSpring(0, { damping: 15, stiffness: 100 })
    );

    // 3. Straightforward Loading Bar
    barWidth.value = withDelay(
      600,
      withTiming(100, { duration: 2500, easing: Easing.inOut(Easing.quad) }, (finished) => {
        if (finished) {
          runOnJS(finishSplash)();
        }
      })
    );
    
    // Safety fallback
    const timer = setTimeout(finishSplash, 3500);
    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%`,
  }));

  const maxBarWidth = Math.min(width * 0.6, 280);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />

      {/* Main Content Center */}
      <View style={styles.content}>
        
        {/* Simple Logo Reveal */}
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <LogoMark size={90} />
        </Animated.View>

        {/* Professional Typography */}
        <Animated.View style={[styles.textGroup, textStyle]}>
          <Text style={styles.wordmark}>
            MyDear<Text style={styles.brandColor}>Partner</Text>
          </Text>
          <Text style={styles.tagline}>
            TRUSTED MATCHMAKING
          </Text>
        </Animated.View>

      </View>

      {/* Elegant Loading Bar at the bottom */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={[styles.track, { width: maxBarWidth }]}>
          <Animated.View style={[styles.fill, progressStyle]} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { 
    flex: 1, 
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40, // offset slightly to balance the footer
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  textGroup: {
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '700',
    fontSize: 32,
    color: '#222222', // Dark, highly readable text
    letterSpacing: -0.5,
  },
  brandColor: { 
    color: colors.primary, // #FF1E66
  },
  tagline: {
    marginTop: 8,
    fontSize: 12,
    letterSpacing: 2.5,
    color: '#666666',
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: '12%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  track: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#EEEEEE', // Subtle track
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: colors.primary, // #FF1E66
  },
});
