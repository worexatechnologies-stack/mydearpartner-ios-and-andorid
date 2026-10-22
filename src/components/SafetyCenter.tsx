import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ReportTarget,
  reportReasons,
  requestAccountDeletion,
  submitReport,
} from '../api/safetyService';
import { useAuth } from '../context/AuthContext';
import legal from '../config/legal.json';
import { tokens } from '../theme/tokens';
import { platformTheme } from '../theme/platform';
import LinearGradient from 'react-native-linear-gradient';
import analyticsService from '../services/analyticsService';

export type SafetyPage = 'privacy' | 'terms' | 'safety' | 'report' | 'delete';

export default function SafetyCenter({
  page,
  onClose,
  target,
}: {
  page: SafetyPage | null;
  onClose: () => void;
  target?: ReportTarget;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const { logout } = useAuth();
  const [reason, setReason] = useState<string>(reportReasons[0]);
  const [details, setDetails] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  
  const policy = page === 'privacy' || page === 'terms' || page === 'safety' ? legal[page] : null;
  
  const close = () => {
    if (submitting.current) return;
    setDetails('');
    setConfirmed(false);
    setReason(reportReasons[0]);
    onClose();
  };
  
  const submit = async () => {
    if (submitting.current || !confirmed || (page === 'report' && !target)) return;
    submitting.current = true;
    setBusy(true);
    try {
      const result = page === 'delete'
        ? await requestAccountDeletion()
        : await submitReport(target!, reason, details);

      if (page === 'report') {
        analyticsService.trackReportSubmitted({ restricted_category: reason }).catch(() => {});
      }
        
      Alert.alert(
        'Request received',
        page === 'delete'
          ? `Your account is scheduled for deletion. You can recover it until ${new Date('recovery_until' in result ? result.recovery_until : '').toLocaleDateString()}.`
          : `Report reference: ${'id' in result ? result.id : ''}. The safety team will review your report.`,
        [{ text: 'OK', onPress: close }],
      );
      if (page === 'delete') {
        onClose();
        await logout().catch(() => {
          Alert.alert('Account scheduled for deletion', 'Please restart the app to finish signing out.');
        });
      }
    } catch (error) {
      Alert.alert(
        'Request not confirmed',
        error instanceof Error ? error.message : 'Please retry or contact support@mydearpartner.in.',
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <Modal visible={page !== null} animationType="slide" onRequestClose={close}>
      <View style={styles.screen}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 20) + 16 }]}>
            <View style={[styles.headerInner, isTablet && styles.constrained]}>
              <TouchableOpacity onPress={close} style={styles.closeButton} disabled={busy}>
                <Text style={{ fontSize: 24, color: tokens.colors.bgTop, fontWeight: '300' }}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>
                {policy?.title ?? (page === 'delete' ? 'Delete Account' : 'Report a safety concern')}
              </Text>
              <View style={styles.closeButton} /> {/* Spacer */}
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[styles.content, isTablet && styles.constrained]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {policy ? (
              <View style={styles.policyContainer}>
                <Text style={styles.versionText}>Version {legal.version}</Text>
                {policy.sections.map(section => (
                  <View key={section.heading} style={styles.sectionBlock}>
                    <Text style={styles.heading}>{section.heading}</Text>
                    <Text style={styles.body}>{section.body}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <>
                {page === 'report' ? (
                  <>
                    <View style={styles.iconContainer}>
                      <Text style={{ fontSize: 48 }}>🛡️</Text>
                    </View>
                    
                    <Text style={styles.subtitle}>
                      Report this {target?.messageId ? 'message' : target?.chatId ? 'conversation' : 'profile'}. Select a reason:
                    </Text>
                    
                    <View style={styles.optionsList}>
                      {reportReasons.map(item => (
                        <TouchableOpacity
                          key={item}
                          activeOpacity={0.7}
                          onPress={() => setReason(item)}
                          style={[
                            styles.choiceCard,
                            reason === item && styles.choiceCardSelected
                          ]}
                        >
                          <View style={styles.radioContainer}>
                            {reason === item ? (
                              <View style={[styles.radioCircle, styles.radioCircleSelected]}>
                                <View style={styles.radioDot} />
                              </View>
                            ) : (
                              <View style={styles.radioCircle} />
                            )}
                          </View>
                          <Text style={[styles.choiceText, reason === item && styles.choiceTextSelected]}>
                            {item}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Additional Details (Optional)</Text>
                    <TextInput
                      placeholder="Describe the concern..."
                      placeholderTextColor="#94A3B8"
                      multiline
                      maxLength={2000}
                      value={details}
                      onChangeText={setDetails}
                      style={styles.input}
                      textAlignVertical="top"
                    />
                    
                    <View style={styles.disclaimerBox}>
                      <Text style={styles.disclaimerText}>
                        Only identifiers and details entered are shared with safety. Do not reproduce illegal imagery.
                      </Text>
                    </View>
                  </>
                ) : (
                  <Text style={styles.body}>
                    Your account will be deactivated and scheduled for deletion. You can recover it within 30 days.
                  </Text>
                )}

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setConfirmed(!confirmed)}
                  style={styles.confirmRow}
                >
                  {confirmed ? (
                    <View style={[styles.checkbox, styles.checkboxSelected]}>
                      <Text style={{ color: 'white', fontSize: 14, fontWeight: '800' }}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.checkbox} />
                  )}
                  <Text style={styles.confirmText}>
                    {page === 'delete'
                      ? 'I want my account and associated data deleted.'
                      : 'I agree to share this report with the safety team.'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.submitButton, { borderRadius: platformTheme.shape.buttonRadius }, (!confirmed || (page === 'report' && !target) || busy) && styles.submitButtonDisabled]}
                  onPress={submit}
                  disabled={!confirmed || (page === 'report' && !target) || busy}
                >
                  <LinearGradient 
                    colors={(!confirmed || (page === 'report' && !target) || busy) ? ['#E2E8F0', '#E2E8F0'] : [tokens.colors.roseLight, tokens.colors.rose]} 
                    style={[StyleSheet.absoluteFill, { borderRadius: platformTheme.shape.buttonRadius }]} 
                  />
                  <Text style={styles.submitButtonText}>
                    {busy ? 'Submitting...' : page === 'delete' ? 'Request Deletion' : 'Submit Report'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  constrained: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  closeButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { ...tokens.typography.tab, color: tokens.colors.bgTop, fontSize: 18 },
  content: { padding: 24, paddingBottom: 60 },
  policyContainer: { gap: 16 },
  versionText: { ...tokens.typography.chip, color: '#64748B', marginBottom: 8 },
  sectionBlock: { marginBottom: 16 },
  heading: { ...tokens.typography.title, fontSize: 20, color: tokens.colors.bgTop, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 24, color: '#334155' },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  subtitle: { ...tokens.typography.tab, color: '#475569', marginBottom: 16, textAlign: 'center' },
  optionsList: { gap: 12, marginBottom: 24 },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  choiceCardSelected: {
    borderColor: tokens.colors.rose,
    backgroundColor: tokens.colors.blush,
  },
  radioContainer: { marginRight: 12 },
  radioCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center'
  },
  radioCircleSelected: {
    borderColor: tokens.colors.rose,
  },
  radioDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: tokens.colors.rose
  },
  choiceText: { ...tokens.typography.tab, color: '#334155' },
  choiceTextSelected: { color: tokens.colors.bgTop, fontWeight: '700' },
  label: { ...tokens.typography.tab, color: '#475569', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 120,
    padding: 16,
    color: '#0F172A',
    fontSize: 16,
    marginBottom: 20,
  },
  disclaimerBox: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  disclaimerText: { fontSize: 13, lineHeight: 20, color: '#64748B' },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
    paddingRight: 20,
  },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center'
  },
  checkboxSelected: {
    backgroundColor: tokens.colors.rose,
    borderColor: tokens.colors.rose,
  },
  confirmText: { fontSize: 15, color: '#334155', flex: 1, lineHeight: 22 },
  submitButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: tokens.colors.rose,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  submitButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    ...tokens.typography.title,
    fontSize: 18,
    color: '#FFFFFF',
  },
});
