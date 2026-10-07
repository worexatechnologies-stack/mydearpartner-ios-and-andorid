import { useSafeAreaInsets } from 'react-native-safe-area-context';
/**
 * MyDearPartner — Offline Banner
 *
 * A sticky banner that slides down from the top when the device goes offline.
 * Drop it anywhere near the root of your screen tree.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [bannerHeight, setBannerHeight] = useState(160);
  const { isConnected } = useNetworkStatus();
  const reducedMotion = useReducedMotion();
  const slideAnim = useRef(new Animated.Value(-160)).current;

  useEffect(() => {
    if (reducedMotion) {
      slideAnim.setValue(isConnected ? -bannerHeight : 0);
      return;
    }
    const animation = Animated.spring(slideAnim, {
      toValue: isConnected ? -bannerHeight : 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    });
    animation.start();
    return () => animation.stop();
  }, [isConnected, slideAnim, reducedMotion, bannerHeight]);

  return (
    <Animated.View
      onLayout={({ nativeEvent }) => setBannerHeight(nativeEvent.layout.height)}
      style={[
        styles.banner,
        { paddingTop: insets.top + 10, transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="none"
      accessibilityElementsHidden={isConnected}
      importantForAccessibility={isConnected ? 'no-hide-descendants' : 'auto'}
      accessibilityLiveRegion="assertive"
      accessibilityLabel={
        isConnected ? undefined : 'Cannot reach MyDearPartner'
      }
    >
      <Icon
        name="cloud-offline-outline"
        size={16}
        color="#FFF"
        style={{ marginRight: 8 }}
      />
      <Text style={styles.text}>Cannot connect. Check your connection.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  text: {
    flexShrink: 1,
    textAlign: 'center',
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
