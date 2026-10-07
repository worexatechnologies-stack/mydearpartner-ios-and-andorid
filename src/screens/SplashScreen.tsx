import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';

const PARTICLES = Array.from({ length: 40 }, (_, index) => ({
  angle: index * 2.39996,
  radius: 0.55 + (index % 7) * 0.06,
  size: 2 + (index % 3),
  color: index % 2 ? '#F58FAE' : '#BE1E2D',
}));

export default function SplashScreen({
  onComplete,
}: {
  onComplete?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const completion = useRef(onComplete);
  completion.current = onComplete;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 600 : 5800,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) completion.current?.();
    });
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const fade = (start: number, end: number) =>
    reducedMotion
      ? 1
      : progress.interpolate({
          inputRange: [start / 5800, end / 5800],
          outputRange: [0, 1],
          extrapolate: 'clamp',
        });
  const rise = (start: number, end: number) =>
    reducedMotion
      ? 0
      : progress.interpolate({
          inputRange: [start / 5800, end / 5800],
          outputRange: [10, 0],
          extrapolate: 'clamp',
        });
  const logoSize = Math.min(width * 0.52, height * 0.28, 250);
  const barWidth = Math.min(width * 0.4, 200);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={['#FFFFFF', '#FFFFFF', '#FFF0F4']}
        locations={[0, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {!reducedMotion &&
          PARTICLES.map((particle, index) => {
            const distance = Math.max(width, height) * particle.radius;
            const startX = Math.cos(particle.angle) * distance;
            const startY = Math.sin(particle.angle) * distance;
            return (
              <Animated.View
                key={index}
                style={[
                  styles.particle,
                  {
                    left: width / 2,
                    top: height * 0.3,
                    width: particle.size,
                    height: particle.size,
                    backgroundColor: particle.color,
                    opacity: progress.interpolate({
                      inputRange: [0, 0.12, 0.38, 0.59, 1],
                      outputRange: [0, 0.65, 0.65, 0, 0],
                    }),
                    transform: [
                      {
                        translateX: progress.interpolate({
                          inputRange: [0, 0.38, 1],
                          outputRange: [startX, 0, 0],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        translateY: progress.interpolate({
                          inputRange: [0, 0.38, 1],
                          outputRange: [startY, 0, 0],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
        {!reducedMotion &&
          [0, 1, 2, 3].map(index => (
            <Animated.View
              key={`petal-${index}`}
              style={[
                styles.petal,
                {
                  left: width * (0.18 + index * 0.2),
                  opacity: progress.interpolate({
                    inputRange: [
                      0,
                      (2500 + index * 450) / 5800,
                      (2800 + index * 450) / 5800,
                      1,
                    ],
                    outputRange: [0, 0, 0.7, 0],
                  }),
                  transform: [
                    {
                      translateY: progress.interpolate({
                        inputRange: [(2500 + index * 450) / 5800, 1],
                        outputRange: [-30, height],
                        extrapolate: 'clamp',
                      }),
                    },
                    {
                      rotate: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '260deg'],
                      }),
                    },
                  ],
                },
              ]}
            />
          ))}
      </View>
      <Animated.Image
        accessibilityLabel="MyDearPartner logo"
        source={require('../assets/images/splash-preview-logo.png')}
        resizeMode="contain"
        style={[
          styles.logo,
          {
            width: logoSize,
            height: logoSize,
            top: height * 0.3 - logoSize / 2,
            opacity: fade(900, 2300),
            transform: [
              {
                scale: reducedMotion
                  ? 1
                  : progress.interpolate({
                      inputRange: [900 / 5800, 2300 / 5800],
                      outputRange: [0.96, 1],
                      extrapolate: 'clamp',
                    }),
              },
            ],
          },
        ]}
      />
      <View style={[styles.textGroup, { top: height * 0.56 }]}>
        <Animated.Text
          style={[
            styles.wordmark,
            {
              fontSize: Math.min(36, width * 0.085),
              opacity: fade(2200, 3000),
              transform: [{ translateY: rise(2200, 3000) }],
            },
          ]}
        >
          MyDear<Text style={styles.rose}>Partner</Text>
        </Animated.Text>
        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: fade(2900, 3700),
              transform: [{ translateY: rise(2900, 3700) }],
            },
          ]}
        >
          LOVE • CONNECT • GROW
        </Animated.Text>
        <Animated.Text
          style={[
            styles.signature,
            {
              opacity: fade(3500, 4300),
              transform: [{ translateY: rise(3500, 4300) }],
            },
          ]}
        >
          Together Always ♡
        </Animated.Text>
      </View>
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View
          accessibilityLabel="Starting MyDearPartner"
          style={[styles.track, { width: barWidth }]}
        >
          <Animated.View
            style={[
              styles.fill,
              {
                width: barWidth,
                transform: [
                  {
                    translateX: reducedMotion
                      ? 0
                      : progress.interpolate({
                          inputRange: [3000 / 5800, 5400 / 5800],
                          outputRange: [-barWidth, 0],
                          extrapolate: 'clamp',
                        }),
                  },
                ],
              },
            ]}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  logo: { position: 'absolute', alignSelf: 'center' },
  textGroup: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  wordmark: {
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontWeight: '600',
    color: '#2B2B2B',
  },
  rose: { color: '#F58FAE' },
  tagline: {
    marginTop: 14,
    fontSize: 10,
    letterSpacing: 3,
    color: '#BE1E2D',
    fontWeight: '500',
  },
  signature: {
    marginTop: 18,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    fontStyle: 'italic',
    fontSize: 23,
    color: '#F58FAE',
  },
  footer: {
    position: 'absolute',
    bottom: '7%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FBE3EA',
    overflow: 'hidden',
  },
  fill: { height: 3, backgroundColor: '#F58FAE' },
  particle: { position: 'absolute', borderRadius: 3 },
  petal: {
    position: 'absolute',
    top: 0,
    width: 12,
    height: 16,
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#F9B3C8',
  },
});
