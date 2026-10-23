import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Profile } from '../types/models';
import { calculateGeminiHoroscopeMatch } from '../services/geminiHoroscopeService';
import { colors } from '../theme/theme';
import { AnimatedCompatibilityRing } from './AnimatedProgress';
import MotionView from './MotionView';

interface Props {
  visible: boolean;
  onClose: () => void;
  myProfile?: Profile | null;
  theirProfile: Profile;
}

/** Explain the reported score without inventing weights or requesting AI. */
export default function CompatibilityBreakdownModal({ visible, onClose, myProfile, theirProfile }: Props) {
  const insets = useSafeAreaInsets();
  const analysis = useMemo(() => calculateGeminiHoroscopeMatch(myProfile, theirProfile), [myProfile, theirProfile]);
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Match score</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close match score"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.scoreCard}>
              <View style={styles.ringWrapper}>
                <AnimatedCompatibilityRing score={analysis.score} size={124} strokeWidth={7} />
              </View>
              {/* Maintain semantic score display for accessibility and test verification */}
              <Text style={styles.score}>
                {analysis.score === null ? 'Not available' : `${analysis.score}%`}
              </Text>
              <Text style={styles.bodyCenter}>Reported match score for {theirProfile.name}</Text>
            </View>

            <Text style={styles.body}>
              {analysis.score === null
                ? 'A match score has not been provided for this profile.'
                : 'This score was supplied with the profile. Its calculation and factor weights are not available, so we cannot show how each attribute contributed.'}
            </Text>

            <Text style={styles.heading}>Profile facts for comparison</Text>
            <Text style={styles.body}>These facts provide context. They are not a calculated breakdown of the percentage above.</Text>

            {analysis.comparisons.map((item, index) => (
              <MotionView key={item.label} index={index} style={styles.fact}>
                <View style={styles.factHeader}>
                  <Text style={styles.factTitle}>{item.label}</Text>
                  <View style={[
                    styles.statusBadge,
                    item.matched === true ? styles.statusShared : item.matched === false ? styles.statusDifferent : styles.statusIncomplete
                  ]}>
                    <Text style={[
                      styles.statusText,
                      item.matched === true ? styles.statusTextShared : item.matched === false ? styles.statusTextDifferent : styles.statusTextIncomplete
                    ]}>
                      {item.matched === null ? 'Incomplete' : item.matched ? 'Shared' : 'Different'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.body}>
                  You: {item.yours || 'Not provided'}{'\n'}
                  {theirProfile.name.split(' ')[0]}: {item.theirs || 'Not provided'}
                </Text>
              </MotionView>
            ))}

            {!!analysis.missingInformation.length && (
              <MotionView index={analysis.comparisons.length} style={styles.missingCard}>
                <Text style={styles.heading}>Missing information</Text>
                {analysis.missingInformation.map(item => (
                  <Text key={item} style={styles.body}>• {item}</Text>
                ))}
              </MotionView>
            )}

            <Text style={styles.note}>
              A match score does not predict relationship success. Use Profile Match Insights for conversation ideas and optional AI suggestions.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    maxHeight: '90%',
    flexShrink: 1,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  closeText: { color: colors.primary, fontWeight: '700' },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { padding: 20, paddingTop: 0, gap: 12 },
  scoreCard: {
    backgroundColor: colors.surfaceTint,
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
  },
  ringWrapper: {
    marginVertical: 4,
  },
  score: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  bodyCenter: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 },
  body: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  fact: {
    backgroundColor: colors.background,
    padding: 14,
    borderRadius: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(165, 55, 96, 0.08)',
  },
  factHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  factTitle: { fontWeight: '700', color: colors.text, fontSize: 15 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusShared: { backgroundColor: 'rgba(16, 185, 129, 0.12)' },
  statusDifferent: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  statusIncomplete: { backgroundColor: 'rgba(107, 114, 128, 0.1)' },
  statusText: { fontSize: 11, fontWeight: '600' },
  statusTextShared: { color: '#059669' },
  statusTextDifferent: { color: '#DC2626' },
  statusTextIncomplete: { color: '#6B7280' },
  missingCard: {
    backgroundColor: colors.surfaceTint,
    padding: 14,
    borderRadius: 14,
    gap: 6,
  },
  note: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
});

