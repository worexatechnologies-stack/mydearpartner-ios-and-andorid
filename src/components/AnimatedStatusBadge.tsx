import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { colors } from '../theme/theme';

export type BadgeStatus =
  | 'pending'
  | 'accepted'
  | 'connected'
  | 'declined'
  | 'cancelled'
  | 'shortlisted'
  | 'verified';

interface AnimatedStatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  size?: 'small' | 'medium';
}

const STATUS_CONFIG: Record<
  BadgeStatus,
  {
    bg: string;
    border: string;
    text: string;
    icon: string;
    defaultLabel: string;
  }
> = {
  pending: {
    bg: 'rgba(245, 158, 11, 0.12)',
    border: 'rgba(245, 158, 11, 0.3)',
    text: '#D97706',
    icon: 'time-outline',
    defaultLabel: 'Pending',
  },
  accepted: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#059669',
    icon: 'checkmark-circle-outline',
    defaultLabel: 'Accepted',
  },
  connected: {
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.4)',
    text: '#047857',
    icon: 'chatbubbles-outline',
    defaultLabel: 'Connected',
  },
  declined: {
    bg: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.25)',
    text: '#DC2626',
    icon: 'close-circle-outline',
    defaultLabel: 'Declined',
  },
  cancelled: {
    bg: 'rgba(107, 114, 128, 0.1)',
    border: 'rgba(107, 114, 128, 0.25)',
    text: '#6B7280',
    icon: 'remove-circle-outline',
    defaultLabel: 'Cancelled',
  },
  shortlisted: {
    bg: 'rgba(217, 20, 90, 0.12)',
    border: 'rgba(217, 20, 90, 0.3)',
    text: colors.action,
    icon: 'heart',
    defaultLabel: 'Shortlisted',
  },
  verified: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: 'rgba(16, 185, 129, 0.3)',
    text: '#059669',
    icon: 'shield-checkmark',
    defaultLabel: 'Verified',
  },
};

export default function AnimatedStatusBadge({
  status,
  label,
  size = 'small',
}: AnimatedStatusBadgeProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(reduced ? 1 : 0.8)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const displayText = label || config.defaultLabel;

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      opacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status, reduced, scale, opacity]);

  const isSmall = size === 'small';

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
          opacity,
          transform: [{ scale }],
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
      ]}
    >
      <Icon
        name={config.icon}
        size={isSmall ? 11 : 13}
        color={config.text}
        style={{ marginRight: 4 }}
      />
      <Text
        style={[
          styles.label,
          {
            color: config.text,
            fontSize: isSmall ? 11 : 12,
          },
        ]}
      >
        {displayText}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
  },
});
