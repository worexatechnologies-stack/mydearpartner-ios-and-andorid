/**
 * TypingIndicator — Animated "someone is typing" bubble for chat.
 *
 * Shows three bouncing dots in a frosted speech-bubble shape.
 * Designed to sit at the bottom of the chat message list.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme/theme';

interface TypingIndicatorProps {
  typingUserName?: string;
  visible: boolean;
}

export default function TypingIndicator({
  typingUserName,
  visible,
}: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(containerOpacity, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, containerOpacity]);

  useEffect(() => {
    if (!visible) return;

    const bounceDot = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: -6,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600),
        ]),
      );

    const a1 = bounceDot(dot1, 0);
    const a2 = bounceDot(dot2, 150);
    const a3 = bounceDot(dot3, 300);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [visible, dot1, dot2, dot3]);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      accessibilityLabel={typingUserName ? `${typingUserName} is typing` : 'Someone is typing'}
      accessible
    >
      <View style={styles.bubble}>
        {[dot1, dot2, dot3].map((dot, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { transform: [{ translateY: dot }] }]}
          />
        ))}
      </View>
      {typingUserName ? (
        <Text style={styles.label}>{typingUserName} is typing…</Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    marginBottom: 4,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 5,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  label: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },
});
