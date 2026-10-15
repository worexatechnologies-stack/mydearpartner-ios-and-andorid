import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  size?: 'small' | 'large' | number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  showBar?: boolean;
}

/** Native version of the supplied loading_preview.html buffering animation. */
export default function BufferingIndicator({
  size = 'small', color = '#C41E3A', style,
  accessibilityLabel = 'Loading', showBar = false,
}: Props) {
  const diameter = typeof size === 'number' ? size : size === 'large' ? 96 : 28;
  const reducedMotion = useReducedMotion();
  const rotation = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  
  const progress = useRef(new Animated.Value(0)).current;
  const gradientId = `buffering-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    rotation.setValue(0);
    pulse.setValue(0);
    progress.setValue(0);
    if (reducedMotion) return;
    const animations = [
      Animated.loop(Animated.timing(rotation, {
        toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true,
      })),
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])),
    ];
    if (showBar) animations.push(Animated.loop(Animated.timing(progress, {
      toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
    })));
    animations.forEach(animation => animation.start());
    return () => animations.forEach(animation => animation.stop());
  }, [reducedMotion, rotation, pulse, progress, showBar]);

  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel} accessibilityState={{ busy: true }}>
      <View style={[styles.ring, { width: diameter, height: diameter }]}>
        <Animated.View style={[StyleSheet.absoluteFill, {
          transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
        }]}>
          <Svg width={diameter} height={diameter} viewBox="0 0 100 100">
            <Defs><LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0" stopColor={color} /><Stop offset="1" stopColor="#F48FB1" />
            </LinearGradient></Defs>
            <Circle cx="50" cy="50" r="44" fill="none" stroke="#F6D6DE" strokeWidth="5" />
            <Circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${gradientId})`}
              strokeWidth="5" strokeLinecap="round" strokeDasharray="90 300" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }) }] }}>
          <Image source={require('../assets/images/logo.png')} resizeMode="contain"
            accessible={false} style={{ width: diameter / 2, height: diameter * 0.4375 }} />
        </Animated.View>
      </View>
      {showBar ? <View style={styles.bar}>
        <Animated.View style={[styles.progress, { backgroundColor: color,
          transform: [{ translateX: reducedMotion ? 45 : progress.interpolate({ inputRange: [0, 1], outputRange: [-60, 168] }) }],
        }]} />
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  bar: { width: 150, height: 5, borderRadius: 5, backgroundColor: '#F6D6DE', overflow: 'hidden', marginTop: 26 },
  progress: { width: 60, height: 5, borderRadius: 5 },
});
