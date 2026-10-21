import React, { useMemo } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Profile } from '../types/models';
import { calculateGeminiHoroscopeMatch } from '../services/geminiHoroscopeService';
import { colors } from '../theme/theme';

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
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={[styles.overlay, { paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Match score</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close match score" onPress={onClose} style={styles.close}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <View style={styles.scoreCard}>
            <Text style={styles.score}>{analysis.score === null ? 'Not available' : `${analysis.score}%`}</Text>
            <Text style={styles.body}>Reported match score for {theirProfile.name}</Text>
          </View>
          <Text style={styles.body}>{analysis.score === null
            ? 'A match score has not been provided for this profile.'
            : 'This score was supplied with the profile. Its calculation and factor weights are not available, so we cannot show how each attribute contributed.'}</Text>
          <Text style={styles.heading}>Profile facts for comparison</Text>
          <Text style={styles.body}>These facts provide context. They are not a calculated breakdown of the percentage above.</Text>
          {analysis.comparisons.map(item => <View key={item.label} style={styles.fact}>
            <View style={styles.factHeader}><Text style={styles.factTitle}>{item.label}</Text><Text style={styles.status}>{item.matched === null ? 'Incomplete' : item.matched ? 'Shared' : 'Different'}</Text></View>
            <Text style={styles.body}>You: {item.yours || 'Not provided'}{ '\n' }{theirProfile.name.split(' ')[0]}: {item.theirs || 'Not provided'}</Text>
          </View>)}
          {!!analysis.missingInformation.length && <><Text style={styles.heading}>Missing information</Text>{analysis.missingInformation.map(item => <Text key={item} style={styles.body}>• {item}</Text>)}</>}
          <Text style={styles.note}>A match score does not predict relationship success. Use Profile Match Insights for conversation ideas and optional AI suggestions.</Text>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '90%', flexShrink: 1, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, closeText: { color: colors.primary, fontWeight: '700' },
  scroll: { flexShrink: 1, minHeight: 0 }, content: { padding: 20, paddingTop: 0, gap: 12 },
  scoreCard: { backgroundColor: colors.surfaceTint, padding: 20, borderRadius: 16, gap: 8 },
  score: { color: colors.primary, fontSize: 36, fontWeight: '800' },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 }, body: { color: colors.textSecondary, fontSize: 14 },
  fact: { backgroundColor: colors.background, padding: 12, borderRadius: 12, gap: 6 },
  factHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  factTitle: { fontWeight: '700', color: colors.text }, status: { color: colors.primary, fontSize: 12 },
  note: { color: colors.textSecondary, fontSize: 12 },
});
