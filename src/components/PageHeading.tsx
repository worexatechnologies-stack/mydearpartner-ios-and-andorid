import React from 'react';
import { StyleSheet,Text,View } from 'react-native';
import { colors } from '../theme/theme';
export default function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flexShrink: 1 },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 7,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: colors.text,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    marginTop: 6,
  },
});
