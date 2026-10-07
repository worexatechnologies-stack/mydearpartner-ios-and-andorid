import React,{ useCallback,useEffect,useRef,useState } from 'react';
import {
Animated,
DeviceEventEmitter,
PanResponder,
StyleSheet,
Text,
TouchableOpacity,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/theme';
import {
InAppNotificationData,
SHOW_IN_APP_NOTIFICATION_EVENT,
} from '../utils/notifications';
import AuthImage from './AuthImage';

const DEFAULT_DURATION = 4200;

export default function InAppNotification() {
  const [notification, setNotification] =
    useState<InAppNotificationData | null>(null);
  const translateY = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationRef = useRef<InAppNotificationData | null>(null);
  const insets = useSafeAreaInsets();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hideNotification = useCallback(() => {
    clearTimer();
    const dismissing = notificationRef.current;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -160,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || notificationRef.current !== dismissing) return;
      notificationRef.current = null;
      setNotification(null);
    });
  }, [clearTimer, opacity, translateY]);

  const showAnimation = useCallback(
    (duration: number = DEFAULT_DURATION) => {
      clearTimer();
      const topTarget = Math.max(insets.top + 8, 16);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: topTarget,
          friction: 7,
          tension: 45,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideNotification();
      }, duration);
    },
    [clearTimer, hideNotification, insets.top, opacity, translateY],
  );

  useEffect(() => {
    // Mount the listener ONCE so state updates never dismantle active timers or listeners
    const subscription = DeviceEventEmitter.addListener(
      SHOW_IN_APP_NOTIFICATION_EVENT,
      (data: InAppNotificationData) => {
        if (!data || !data.title) return;

        translateY.stopAnimation();
        opacity.stopAnimation();
        notificationRef.current = data;
        setNotification(data);

        // Animate in or bounce if already visible
        showAnimation(data.duration || DEFAULT_DURATION);
      },
    );

    return () => {
      subscription.remove();
      clearTimer();
    };
  }, [clearTimer, showAnimation, translateY, opacity]);

  const panResponder = useRef(
    PanResponder.create({
      // Never steal the initial tap; let TouchableOpacity handle it
      onStartShouldSetPanResponder: () => false,
      // Only capture if user is swiping UP to dismiss
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy < -6,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          const topTarget = Math.max(insets.top + 8, 16);
          translateY.setValue(topTarget + gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -15 || gestureState.vy < -0.4) {
          hideNotification();
        } else {
          // Snap back
          const topTarget = Math.max(insets.top + 8, 16);
          Animated.spring(translateY, {
            toValue: topTarget,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  if (!notification) return null;

  const isInterest =
    notification.type === 'interest' ||
    notification.icon === 'heart' ||
    notification.title.toLowerCase().includes('interest');

  const iconName =
    notification.icon || (isInterest ? 'heart' : 'chatbubble-ellipses');
  const iconColor = isInterest ? '#E11D48' : '#2563EB';
  const iconBg = isInterest
    ? 'rgba(225, 29, 72, 0.12)'
    : 'rgba(37, 99, 235, 0.12)';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
      pointerEvents="box-none"
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}. ${notification.message}`}
        accessibilityLiveRegion="polite"
        activeOpacity={0.92}
        onPress={() => {
          const cb = notification.onPress;
          hideNotification();
          if (cb) {
            cb();
          }
        }}
        style={styles.pill}
      >
        {notification.avatarUrl ? (
          <AuthImage
            source={{ uri: notification.avatarUrl }}
            style={styles.avatar}
          />
        ) : (
          <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
            <Icon name={iconName} size={22} color={iconColor} />
          </View>
        )}

        <View style={styles.textContainer}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.hintText}>Tap to open</Text>
          </View>
          <Text style={styles.message} numberOfLines={2}>
            {notification.message}
          </Text>
        </View>

        <View style={styles.chevronContainer}>
          <Icon name="chevron-forward" size={16} color="#94A3B8" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 999999,
    elevation: 999999, // Crucial for Android so it paints above all screens & headers
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 24, // Card elevation
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
    backgroundColor: '#F1F5F9',
  },
  textContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94A3B8',
  },
  message: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    lineHeight: 18,
  },
  chevronContainer: {
    marginLeft: 6,
    paddingLeft: 4,
  },
});
