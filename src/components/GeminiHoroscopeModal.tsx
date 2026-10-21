import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getMatchCapabilities, getMatchInsights, matchInsightsFailure, MatchInsights } from '../api/matchmakingService';
import { GeminiHoroscopeAnalysis } from '../services/geminiHoroscopeService';
import { Profile } from '../types/models';
import { colors } from '../theme/theme';
import AppButton from './AppButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  analysis: GeminiHoroscopeAnalysis;
  myProfile?: Profile | null;
  theirProfile?: Profile | null;
}

export default function GeminiHoroscopeModal({ visible, onClose, analysis, myProfile, theirProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [insights, setInsights] = useState<MatchInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<'checking' | 'available' | 'not_configured' | 'unavailable'>('checking');
  const requestRevision = useRef(0);
  const checkAvailability = useCallback(async () => {
    const revision = ++requestRevision.current;
    setAvailability('checking'); setError(null);
    try {
      const capabilities = await getMatchCapabilities();
      if (revision === requestRevision.current) setAvailability(capabilities.aiConfigured ? 'available' : 'not_configured');
    } catch {
      if (revision === requestRevision.current) setAvailability('unavailable');
    }
  }, []);
  useEffect(() => {
    requestRevision.current += 1;
    setInsights(null); setError(null); setLoading(false);
    if (visible) checkAvailability();
    return () => { requestRevision.current += 1; };
  }, [visible, theirProfile?.id, myProfile?.id, checkAvailability]);

  const requestInsights = async () => {
    if (!theirProfile?.id || loading || availability !== 'available') return;
    const revision = ++requestRevision.current;
    setLoading(true); setError(null);
    try {
      const result = await getMatchInsights(theirProfile.id, true);
      if (revision === requestRevision.current) setInsights(result);
    } catch (failure) {
      if (revision === requestRevision.current) {
        const status = (failure as { status?: number } | null)?.status;
        if (status === 404 || status === 405 || status === 501) setAvailability('unavailable');
        else setError(matchInsightsFailure(failure));
      }
    } finally {
      if (revision === requestRevision.current) setLoading(false);
    }
  };
  const share = async () => {
    try {
      await Share.share({ message: [
        `Conversation ideas: ${myProfile?.name || 'You'} & ${theirProfile?.name || 'Your match'}`,
        insights?.isAiEnhanced ? 'Includes Gemini AI suggestions' : 'Based on profile information',
        insights?.isAiEnhanced ? insights.summary : 'Profile-based conversation ideas',
        ...analysis.conversationStarters,
      ].join('\n') });
    } catch { /* Share dismissed. */ }
  };
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { paddingLeft: insets.left, paddingRight: insets.right }]}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>Match insights</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close match insights" onPress={onClose} style={styles.close}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.source}>{insights?.isAiEnhanced ? 'Gemini AI insights' : 'Profile-based conversation ideas'}</Text>
            <Text style={styles.body}>{insights?.isAiEnhanced ? insights.summary : `Conversation ideas to help you get to know ${theirProfile?.name?.split(' ')[0] || 'your match'}, based on available profile information.`}</Text>
            {insights?.isAiEnhanced && <Text style={styles.body}>{insights.explanation}</Text>}
            {insights && !insights.isAiEnhanced && <Text style={styles.note}>AI is unavailable. Showing profile-based conversation ideas.</Text>}
            {!!insights?.considerations.length && <><Text style={styles.heading}>Things to discuss</Text>{insights.considerations.map((item, i) => <Text key={i} style={styles.body}>• {item}</Text>)}</>}
            <Text style={styles.heading}>Conversation starters</Text>
            {analysis.conversationStarters.map(item => <Text key={item} style={styles.body}>• {item}</Text>)}
            <View style={styles.aiCard}>
              <Text style={styles.heading}>Optional AI suggestions</Text>
              <View style={styles.availabilityBadge}>
                <Text accessibilityLiveRegion="polite" style={styles.availabilityText}>
                  {availability === 'checking' ? 'Checking availability' : availability === 'available' ? 'AI available on request' : 'Profile suggestions available'}
                </Text>
              </View>
              {availability === 'available' && <Text style={styles.body}>Requesting AI insights shares a limited summary of both profiles’ age, location, work, education, diet, and interests with Google Gemini. AI suggestions may be inaccurate and do not predict a successful relationship.</Text>}
              {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
              {availability === 'available' ? (
                <AppButton title={insights ? 'Refresh AI insights' : 'Request AI insights'} loading={loading} disabled={!theirProfile?.id} onPress={requestInsights} />
              ) : (
                <>
                  <Text accessibilityLiveRegion="polite" style={styles.note}>{availability === 'checking' ? 'Checking AI availability…' : availability === 'not_configured' ? 'AI insights are not enabled right now. Conversation ideas are still available.' : 'AI insights are currently unavailable. Conversation ideas are still available.'}</Text>
                  <AppButton title="Check AI availability" variant="outline" loading={availability === 'checking'} onPress={checkAvailability} />
                </>
              )}
            </View>
            <AppButton title="Share conversation ideas" variant="outline" onPress={share} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 640, alignSelf: 'center', maxHeight: '90%', flexShrink: 1, backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: colors.text },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }, closeText: { color: colors.primary, fontWeight: '700' },
  scroll: { flexShrink: 1, minHeight: 0 },
  content: { padding: 20, paddingTop: 0, gap: 12 }, source: { color: colors.primary, fontWeight: '700' },
  heading: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 8 }, body: { color: colors.textSecondary, fontSize: 14 },
  availabilityBadge: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: colors.surfaceTint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  availabilityText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  aiCard: { gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  note: { color: colors.textSecondary }, error: { color: colors.danger },
});
