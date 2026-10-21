import BufferingIndicator from '../../components/BufferingIndicator';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
  Alert,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AppButton from '../../components/AppButton';
import ScreenContainer from '../../components/ScreenContainer';
import { RootStackParamList } from '../../navigation/types';
import { colors, fontSizes, radii, shadow, spacing } from '../../theme/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Verification'>;

import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { verificationService } from '../../api/verificationService';
import {
  COMPATIBLE_CAMERA_OPTIONS,
  COMPATIBLE_IMAGE_PICKER_OPTIONS,
} from '../../utils/profilePhotos';

export default function VerificationScreen({ navigation }: Props) {
  const [idVerified, setIdVerified] = useState(false);
  const [selfieVerified, setSelfieVerified] = useState(false);
  const [incomeVerified, setIncomeVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statusError, setStatusError] = useState('');

  React.useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setIsLoading(true);
    setStatusError('');
    try {
      const status = await verificationService.getStatus();
      setIdVerified(status.idVerified);
      setSelfieVerified(status.selfieVerified);
      setIncomeVerified(status.incomeVerified);
    } catch {
      setStatusError('Unable to load verification status. Please retry.');
    } finally {
      setIsLoading(false);
    }
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const onUploadDoc = (docType: string) => {
    Alert.alert(
      'Upload Document',
      `Your ${docType} document will be uploaded to My Dear Partner for verification review. It is not intended for your public profile. Share only the information needed for verification. You can request deletion in Settings. Continue by selecting a photo?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Gallery',
          onPress: () => {
            launchImageLibrary(
              COMPATIBLE_IMAGE_PICKER_OPTIONS,
              async response => {
                if (
                  response.didCancel ||
                  !response.assets ||
                  response.assets.length === 0
                )
                  return;
                const asset = response.assets[0];
                if (!asset.uri) return;

                setIsProcessing(true);
                try {
                  const status = await verificationService.submitDocument(
                    docType,
                    asset.uri,
                    asset.fileName ?? 'document.jpg',
                    asset.type ?? 'image/jpeg',
                  );
                  setIdVerified(status.idVerified);
                  setIncomeVerified(status.incomeVerified);
                  Alert.alert(
                    'Submitted',
                    'Your document has been submitted for review.',
                  );
                } catch (e: any) {
                  Alert.alert(
                    'Upload Failed',
                    e?.message ??
                      'Could not upload document. Please try again.',
                  );
                } finally {
                  setIsProcessing(false);
                }
              },
            );
          },
        },
      ],
    );
  };

  const handleTakeSelfie = () => {
    Alert.alert(
      'Selfie verification',
      'Your selfie will be uploaded to My Dear Partner for verification review. You can request deletion in Settings. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Camera', onPress: handleCapture },
      ],
    );
  };

  const handleCapture = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Camera permission needed',
            'Allow camera access in Settings to take a verification selfie.',
          );
          return;
        }
      }
      const response = await launchCamera(COMPATIBLE_CAMERA_OPTIONS);
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert(
          'Camera unavailable',
          response.errorCode === 'permission'
            ? 'Allow camera access in Settings to take a verification selfie.'
            : 'Could not open the camera. On a simulator, try this on a physical phone.',
        );
        return;
      }
      const asset = response.assets?.[0];
      if (!asset?.uri) {
        Alert.alert(
          'No selfie captured',
          'Please open the camera and take a new selfie.',
        );
        return;
      }
      const status = await verificationService.submitSelfie(asset.uri);
      setSelfieVerified(status.selfieVerified);
      Alert.alert(
        status.selfieVerified ? 'Selfie Verified' : 'Selfie Submitted',
        status.selfieVerified
          ? 'Your selfie verification is complete.'
          : 'Your selfie has been submitted for review.',
      );
    } catch (e: any) {
      Alert.alert(
        'Selfie submission failed',
        e?.message ??
          'Could not capture or upload your selfie. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? <BufferingIndicator color={colors.primary} /> : null}
        {statusError ? (
          <View accessibilityRole="alert">
            <Text style={{ color: colors.text }}>{statusError}</Text>
            <AppButton
              title="Retry verification status"
              onPress={loadStatus}
              variant="secondary"
            />
          </View>
        ) : null}
        {/* Trust Score Header */}
        <View style={styles.headerCard}>
          <View style={styles.trustBadgeWrapper}>
            <Icon name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={styles.trustScoreTitle}>Profile Verification</Text>
          <Text style={styles.trustScoreSubtitle}>
            {selfieVerified
              ? 'Your selfie has been reviewed and approved.'
              : 'Submit a selfie for review. Approval is confirmed by our team.'}
          </Text>

          {selfieVerified && (
            <View style={styles.badgePreview}>
              <Icon
                name="shield-checkmark"
                size={13}
                color="#FFF"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.badgePreviewText}>VERIFIED MEMBER</Text>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.sectionHeader}>Why get 100% verified?</Text>
          <View style={styles.benefitItem}>
            <Icon
              name="rocket-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 10 }}
            />
            <Text style={styles.benefitText}>
              Get 3x more interest acceptances and matches.
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Icon
              name="lock-closed-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 10 }}
            />
            <Text style={styles.benefitText}>
              Build genuine trust with prospective families.
            </Text>
          </View>
          <View style={styles.benefitItem}>
            <Icon
              name="ribbon-outline"
              size={18}
              color={colors.primary}
              style={{ marginRight: 10 }}
            />
            <Text style={styles.benefitText}>
              Priority placement at the top of member search results.
            </Text>
          </View>
        </View>

        {/* Verification Steps */}
        <Text style={styles.sectionTitle}>Verification Steps</Text>

        {/* Step 1: Govt ID */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>1</Text>
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>Government ID Proof</Text>
              <Text style={styles.stepDesc}>
                Aadhaar Card, Passport, or Driving License
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                idVerified ? styles.statusPillGreen : null,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  idVerified ? styles.statusPillTextGreen : null,
                ]}
              >
                {idVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          {!idVerified ? (
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => onUploadDoc('Government ID')}
              disabled={isLoading || isProcessing}
            >
              <Text style={styles.uploadBtnText}>Upload Govt ID</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Step 2: Photo Selfie */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>2</Text>
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>Live Selfie Verification</Text>
              <Text style={styles.stepDesc}>
                Confirms profile photos belong to you
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                selfieVerified ? styles.statusPillGreen : null,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  selfieVerified ? styles.statusPillTextGreen : null,
                ]}
              >
                {selfieVerified ? 'Verified' : 'Pending'}
              </Text>
            </View>
          </View>
          {!selfieVerified ? (
            <TouchableOpacity
              style={[
                styles.uploadBtn,
                {
                  backgroundColor: colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
              onPress={handleTakeSelfie}
              disabled={isLoading || isProcessing}
            >
              <Text style={[styles.uploadBtnText, { color: colors.primary }]}>
                Take Selfie
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Step 3: Income & Profession */}
        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>3</Text>
            </View>
            <View style={styles.stepTexts}>
              <Text style={styles.stepTitle}>Income & Salary Proof</Text>
              <Text style={styles.stepDesc}>
                Payslip, Form 16 or ITR (Optional)
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                incomeVerified ? styles.statusPillGreen : null,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  incomeVerified ? styles.statusPillTextGreen : null,
                ]}
              >
                {incomeVerified ? 'Verified' : 'Optional'}
              </Text>
            </View>
          </View>
          {!incomeVerified ? (
            <TouchableOpacity
              style={styles.uploadBtn}
              onPress={() => onUploadDoc('Income Certificate')}
              disabled={isLoading || isProcessing}
            >
              <Text style={styles.uploadBtnText}>+ Upload Document</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.footerBtn}>
          <AppButton title="Done" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.background,
  },
  headerCard: {
    backgroundColor: '#ECFDF5',
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: spacing.md,
  },
  trustBadgeWrapper: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    marginBottom: spacing.xs,
  },
  trustIcon: {
    fontSize: 28,
  },
  trustScoreTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '900',
    color: '#065F46',
  },
  trustScoreSubtitle: {
    fontSize: fontSizes.xs + 1,
    color: '#047857',
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '500',
  },
  badgePreview: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  badgePreviewText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  benefitsCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...shadow.card,
  },
  sectionHeader: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: spacing.sm,
  },
  benefitText: {
    fontSize: fontSizes.xs,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  sectionTitle: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...shadow.card,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepNumText: {
    fontSize: fontSizes.xs,
    fontWeight: '800',
    color: colors.primary,
  },
  stepTexts: {
    flex: 1,
  },
  stepTitle: {
    fontSize: fontSizes.sm,
    fontWeight: '800',
    color: colors.text,
  },
  stepDesc: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 1,
  },
  statusPill: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  statusPillGreen: {
    backgroundColor: colors.successLight,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6B7280',
  },
  statusPillTextGreen: {
    color: colors.success,
  },
  uploadBtn: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: radii.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  uploadBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.primary,
  },
  footerBtn: {
    marginTop: spacing.md,
  },
});
