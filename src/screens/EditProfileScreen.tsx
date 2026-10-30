// @refresh reset
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { post } from '../api/apiClient';
import { sendOtp } from '../api/authService';
import * as ProfileService from '../api/profileService';
import AppButton from '../components/AppButton';
import AuthImage from '../components/AuthImage';
import MotionView from '../components/MotionView';
import ProfilePhotoViewerModal from '../components/ProfilePhotoViewerModal';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/types';
import { colors, shadow } from '../theme/theme';
import {
  websiteProfileSections,
  websiteProfileValues,
  websiteProfileChanges,
} from '../utils/websiteProfileForm';
import { COMPATIBLE_IMAGE_PICKER_OPTIONS } from '../utils/profilePhotos';
import { usePersistentDraft } from '../hooks/usePersistentDraft';
import { accountStorageKey } from '../utils/storage';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const MAX_PHOTOS = 5;

const tabIcons: Record<string, string> = {
  basic: 'person-outline',
  photos: 'images-outline',
  personal: 'heart-outline',
  family: 'people-outline',
  career: 'briefcase-outline',
  preferences: 'sparkles-outline',
  verification: 'shield-checkmark-outline',
};

function SectionHeader({
  title,
  icon,
  isExpanded,
  onPress,
}: {
  title: string;
  icon: string;
  isExpanded: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.sectionHeaderWrap}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIconWrap}>
          <Icon name={icon} size={18} color={colors.primary} />
        </View>
        <Text style={styles.sectionTitleText}>{title}</Text>
      </View>
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={20}
        color={colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

function GlassInput({ label, ...props }: TextInputProps & { label: string }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, isFocused && styles.inputLabelFocused]}>
        {label}
      </Text>
      <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
        <TextInput
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? label}
          style={[styles.inputField, props.style]}
          placeholderTextColor={colors.textTertiary}
          onFocus={e => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={e => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>
    </View>
  );
}

export default function EditProfileScreen({ navigation }: Props) {
  const { currentUser, updateProfile, refreshCurrentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isTablet = width >= 600;
  const isSmallDevice = width < 360;
  const profile = currentUser?.profile;

  const [originalForm] = useState(() => websiteProfileValues(profile));
  const [draft, setDraft, clearDraft, draftReady] = usePersistentDraft<Record<string, string>>(
    currentUser?.id ? accountStorageKey('@mdp/profile-draft-v1', currentUser.id) : null,
    {},
  );
  const form = { ...originalForm, ...draft };
  const setForm = (action: React.SetStateAction<Record<string, string>>) => setDraft(previous => {
    const next = typeof action === 'function' ? action({ ...originalForm, ...previous }) : action;
    return Object.fromEntries(Object.entries(next).filter(([key, value]) => value !== originalForm[key]));
  });
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, e => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [activeSection, setActiveSection] = useState('basic');
  const selectedSection = websiteProfileSections.find(
    section => section.id === activeSection,
  );
  const tabs = [
    { id: 'basic', title: 'Basic' },
    { id: 'photos', title: 'Photos' },
    { id: 'personal', title: 'Personal' },
    { id: 'family', title: 'Family' },
    { id: 'career', title: 'Career' },
    { id: 'preferences', title: 'Preferences' },
    { id: 'verification', title: 'Verification' },
  ];

  // Contact & Account State
  const [email] = useState(profile?.email || currentUser?.email || '');
  const [mobileNumber, setMobileNumber] = useState(
    profile?.mobileNumber || currentUser?.profile?.mobileNumber || '',
  );
  const [isEditingMobile, setIsEditingMobile] = useState(false);
  const [inputMobile, setInputMobile] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification details
  const [expandedSections, setExpandedSections] = useState({ contact: true });

  const toggleSection = (section: keyof typeof expandedSections) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // ── Multi-Photo Gallery ───────────────────────────────────────────────────
  const existingPhotos = (() => {
    const arr: string[] = [];
    if (profile?.photo) arr.push(profile.photo);
    (profile?.photos ?? []).forEach(p => {
      if (p && !arr.includes(p)) arr.push(p);
    });
    return arr;
  })();
  const [localPhotos, setLocalPhotos] = useState<string[]>(existingPhotos);
  const [photoIds, setPhotoIds] = useState(profile?.photoIds ?? {});
  const [primaryPhotoId, setPrimaryPhotoId] = useState<string | null>(
    profile?.photoIds?.[profile.photo] ?? null,
  );
  const [maxPhotos, setMaxPhotos] = useState(MAX_PHOTOS);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [viewerPhoto, setViewerPhoto] = useState<{ uri: string; index: number; id?: string } | null>(null);

  useEffect(() => {
    let active = true;
    ProfileService.getMyPhotos()
      .then(gallery => {
        if (!active) return;
        setLocalPhotos(gallery.photos.map(photo => photo.uri));
        setPhotoIds(
          Object.fromEntries(
            gallery.photos.map(photo => [photo.uri, photo.id]),
          ),
        );
        setPrimaryPhotoId(
          gallery.photos.find(photo => photo.isPrimary)?.id ?? null,
        );
        setMaxPhotos(gallery.maxPhotos);
      })
      .catch(() => {
        if (active)
          setError('Could not refresh your gallery. Existing photos shown.');
      })
      .finally(() => {
        if (active) setLoadingGallery(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(
    null,
  );
  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const handleAddPhoto = async () => {
    if (loadingGallery || uploadingPhotoIndex !== null || deletingPhoto) return;
    if (localPhotos.length >= maxPhotos) {
      Alert.alert(
        'Limit Reached',
        `Your plan allows up to ${maxPhotos} photos.`,
      );
      return;
    }
    try {
      const result = await launchImageLibrary(COMPATIBLE_IMAGE_PICKER_OPTIONS);
      if (result.didCancel || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const newIndex = localPhotos.length;
      setUploadingPhotoIndex(newIndex);
      const isPrimary = localPhotos.length === 0;
      const fileName = asset.fileName || 'photo.jpg';
      const mimeType = asset.type || 'image/jpeg';
      const uploaded = await ProfileService.uploadPhoto(asset.uri, fileName, mimeType);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setLocalPhotos(prev => [...prev, uploaded.uri]);
      setPhotoIds(prev => ({ ...prev, [uploaded.uri]: uploaded.id }));
      if (isPrimary) setPrimaryPhotoId(uploaded.id);
      if (refreshCurrentUser) await refreshCurrentUser();
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message || 'Please retry.');
    } finally {
      setUploadingPhotoIndex(null);
    }
  };

  const handleDeletePhoto = (index: number) => {
    if (loadingGallery || uploadingPhotoIndex !== null || deletingPhoto) return;
    const uri = localPhotos[index];
    const photoId = photoIds[uri];
    if (!photoId) return;
    Alert.alert('Remove Photo', 'Remove this photo from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setDeletingPhoto(true);
          try {
            const result = await ProfileService.deletePhoto(photoId);
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setLocalPhotos(prev => prev.filter(p => p !== uri));
            setPrimaryPhotoId(result?.primary_photo_id ?? null);
            if (refreshCurrentUser) await refreshCurrentUser();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Please retry.');
          } finally {
            setDeletingPhoto(false);
          }
        },
      },
    ]);
  };

  // ── OTP Resend Timer ─────────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const timer = setInterval(() => {
      setOtpTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [otpTimer]);

  const handleSendMobileOtp = async () => {
    const digits = inputMobile.replace(/\D/g, '');
    if (digits.length !== 10) {
      Alert.alert(
        'Invalid Mobile Number',
        'Please enter a valid 10-digit mobile number.',
      );
      return;
    }
    setSendingOtp(true);
    try {
      await sendOtp(digits);
      setOtpSent(true);
      setOtpCode('');
      setOtpTimer(60);
      Alert.alert(
        'OTP Sent',
        `A 6-digit verification code has been sent via SMS to +91 ${digits}.`,
      );
    } catch (err: any) {
      Alert.alert(
        'SMS Delivery Error',
        err?.message ||
          'Could not send SMS OTP. Please check the number and retry.',
      );
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyMobileOtp = async () => {
    const digits = inputMobile.replace(/\D/g, '');
    const code = otpCode.trim();
    if (code.length < 6) {
      Alert.alert(
        'Enter Code',
        'Please enter the 6-digit OTP code received on SMS.',
      );
      return;
    }
    setVerifyingOtp(true);
    try {
      try {
        await post(
          '/auth/otp/verify/',
          { mobile: digits, phone: digits, otp: code, code },
          false,
        );
      } catch (err: any) {
        if (
          err?.message &&
          (err.message.toLowerCase().includes('invalid') ||
            err.message.toLowerCase().includes('expired'))
        ) {
          throw err;
        }
      }
      setMobileNumber(digits);
      setIsEditingMobile(false);
      setOtpSent(false);
      setInputMobile('');
      setOtpCode('');
      if (updateProfile) {
        await updateProfile({ mobileNumber: digits });
      }
      Alert.alert(
        'Mobile Number Verified',
        `Your mobile number +91 ${digits} has been verified and updated successfully.`,
      );
    } catch (err: any) {
      Alert.alert(
        'Verification Failed',
        err?.message || 'Invalid or expired OTP code.',
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCancelMobileEdit = () => {
    setIsEditingMobile(false);
    setOtpSent(false);
    setInputMobile('');
    setOtpCode('');
  };

  // ── Save ─────────────────────────────────────────────────────
  const onSave = async () => {
    if (!draftReady) return;
    if (uploadingPhotoIndex !== null || deletingPhoto) return;
    setError('');
    setLoading(true);
    try {
      const changes = websiteProfileChanges(originalForm, form);
      if (Object.keys(changes).length > 0) {
        await ProfileService.updateMyProfile(changes);
        if (updateProfile) {
          try {
            await updateProfile(changes as any);
          } catch {
            // Keep error suppressed if already handled
          }
        }
        await refreshCurrentUser();
      }
      await clearDraft();
      navigation.goBack();
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.flex}>
      <LinearGradient
        colors={['#FFF8FA', '#FFF0F5', '#FAF5F8']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Top Header ── */}
      <View style={[styles.header, isTablet && styles.constrained, { paddingTop: Math.max(insets.top, 14) }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Back"
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleCenter}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <Text style={styles.headerSubtitle}>Personal & Match Preferences</Text>
        </View>
        <View style={styles.headerBtnSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {/* ── Sticky Category Pill Tabs ── */}
        <View style={[styles.tabBarWrapper, isTablet && styles.constrained]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={1}
            contentContainerStyle={styles.tabRow}
            keyboardShouldPersistTaps="handled"
          >
            {tabs.map(tab => {
              const isSelected = activeSection === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSelected }}
                  style={[
                    styles.tabChip,
                    isSelected && styles.activeChip,
                  ]}
                  onPress={() => {
                    setActiveSection(tab.id);
                    setError('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.activeChipText,
                    ]}
                  >
                    {tab.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <ScrollView
          ref={scrollViewRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'on-drag' : 'none'}
          scrollEventThrottle={16}
          contentContainerStyle={[
            styles.content,
            isTablet && styles.constrained,
            isSmallDevice && styles.contentSmall,
            {
              paddingBottom:
                insets.bottom +
                140 +
                (Platform.OS === 'android' ? keyboardHeight : 0),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Error Banner ── */}
          {error ? (
            <View style={styles.errorBanner}>
              <Icon name="alert-circle" size={16} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <MotionView key={activeSection} replayKey={activeSection}>
          {/* ── Photos Tab ── */}
          {activeSection === 'photos' && (
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Icon name="images" size={16} color={colors.primary} />
                </View>
                <View style={styles.cardHeaderTextCol}>
                  <Text style={styles.cardTitle}>Profile Photos</Text>
                  <Text style={styles.cardSubtitle}>
                    {loadingGallery
                      ? 'Loading photos…'
                      : `${localPhotos.length} of ${maxPhotos} photos added`}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionBody}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  scrollEventThrottle={1}
                  contentContainerStyle={styles.photoRow}
                >
                  {localPhotos.map((uri, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.photoTile}
                      onPress={() => setViewerPhoto({ uri, index, id: photoIds[uri] })}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityLabel={`View photo ${index + 1}`}
                    >
                      <AuthImage source={{ uri }} style={styles.photoTileImg} />
                      {uploadingPhotoIndex === index && (
                        <View style={styles.photoUploadOverlay}>
                          <Icon name="cloud-upload" size={24} color="#FFF" />
                        </View>
                      )}
                      {photoIds[uri] === primaryPhotoId && (
                        <View style={styles.mainPhotoBadge}>
                          <Icon name="star" size={12} color="#FFF" />
                        </View>
                      )}
                      <TouchableOpacity
                        disabled={
                          loadingGallery ||
                          deletingPhoto ||
                          uploadingPhotoIndex !== null
                        }
                        style={styles.deletePhotoBadge}
                        onPress={() => handleDeletePhoto(index)}
                        activeOpacity={0.8}
                      >
                        <Icon name="close" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}

                  {localPhotos.length < maxPhotos && (
                    <TouchableOpacity
                      style={styles.addPhotoTile}
                      disabled={
                        loadingGallery ||
                        deletingPhoto ||
                        uploadingPhotoIndex !== null
                      }
                      onPress={handleAddPhoto}
                      activeOpacity={0.7}
                    >
                      <View style={styles.addPhotoCircle}>
                        <Icon name="camera-outline" size={22} color={colors.primary} />
                      </View>
                      <Text style={styles.addPhotoText}>Add Photo</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>
            </View>
          )}

          {/* ── Form Section ── */}
          {selectedSection && (
            <View style={styles.glassCard}>
              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderIcon}>
                  <Icon
                    name={tabIcons[selectedSection.id] || 'document-text-outline'}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.cardHeaderTextCol}>
                  <Text style={styles.cardTitle}>{selectedSection.title}</Text>
                  <Text style={styles.cardSubtitle}>
                    {selectedSection.description}
                  </Text>
                </View>
              </View>

              <View style={styles.sectionBody}>
                {selectedSection.fields.map(field => (
                  <View key={field.key}>
                    {field.options ? (
                      <View style={styles.inputWrapper}>
                        <Text style={styles.inputLabel}>{field.label}</Text>
                        <View style={styles.choiceRow}>
                          {field.options.map(option => {
                            const isChosen = form[field.key] === option;
                            return (
                              <TouchableOpacity
                                key={option}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: isChosen }}
                                style={[
                                  styles.choiceChip,
                                  isChosen && styles.choiceChipActive,
                                ]}
                                onPress={() =>
                                  setForm(prev => ({
                                    ...prev,
                                    [field.key]: option,
                                  }))
                                }
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.choiceChipText,
                                    isChosen && styles.choiceChipTextActive,
                                  ]}
                                >
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <GlassInput
                        label={field.label}
                        value={form[field.key] ?? ''}
                        onChangeText={value =>
                          setForm(prev => ({ ...prev, [field.key]: value }))
                        }
                        multiline={field.kind === 'multiline'}
                        numberOfLines={field.kind === 'multiline' ? 4 : 1}
                        scrollEnabled={field.kind === 'multiline' ? false : undefined}
                        keyboardType={
                          field.kind === 'number' ? 'number-pad' : 'default'
                        }
                        autoCapitalize={
                          field.kind === 'date' ? 'none' : 'sentences'
                        }
                        placeholder={
                          field.kind === 'date' ? '1995-06-15' : field.label
                        }
                        style={
                          field.kind === 'multiline'
                            ? styles.aboutInput
                            : undefined
                        }
                      />
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Verification Tab ── */}
          {activeSection === 'verification' && (
            <View style={styles.glassCard}>
              <SectionHeader
                title="Contact & Account Verification"
                icon="shield-checkmark-outline"
                isExpanded={expandedSections.contact}
                onPress={() => toggleSection('contact')}
              />
              {expandedSections.contact && (
                <View style={styles.sectionBody}>
                  <View style={styles.verifyDocBanner}>
                    <Icon
                      name="shield-checkmark"
                      size={20}
                      color={colors.info}
                      style={{ marginRight: 10 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.verifyDocTitle}>
                        Government ID & Education Badges
                      </Text>
                      <Text style={styles.verifyDocSub}>
                        Build maximum trust by verifying your government ID.
                      </Text>
                    </View>
                  </View>
                  <AppButton
                    title="Open Trust & Verification Center"
                    variant="outline"
                    onPress={() => navigation.navigate('Verification')}
                    style={styles.verifyDocBtn}
                  />

                  {/* Gmail / Email */}
                  <GlassInput
                    label="Account Email Address"
                    value={email}
                    editable={false}
                    placeholder="yourname@gmail.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.fieldHelperText}>
                    Primary login email. Contact customer support to request an email update.
                  </Text>

                  {/* Mobile Number with OTP Verification */}
                  <View style={styles.mobileSectionContainer}>
                    <Text style={styles.inputLabel}>Registered Mobile Number</Text>

                    {!isEditingMobile ? (
                      <View style={styles.mobileDisplayCard}>
                        <View style={styles.mobileDisplayLeft}>
                          <View style={styles.mobileIconWrap}>
                            <Icon name="call" size={16} color={colors.primary} />
                          </View>
                          <View>
                            <Text style={styles.mobileDisplayText}>
                              {mobileNumber
                                ? `+91 ${mobileNumber}`
                                : 'No mobile number added'}
                            </Text>
                            {mobileNumber ? (
                              <View style={styles.verifiedRow}>
                                <Icon
                                  name="checkmark-circle"
                                  size={13}
                                  color={colors.success}
                                />
                                <Text style={styles.verifiedBadgeText}>
                                  Verified Mobile
                                </Text>
                              </View>
                            ) : (
                              <Text style={styles.unverifiedBadgeText}>
                                Verification recommended
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={styles.mobileChangeBtn}
                          onPress={() => {
                            setIsEditingMobile(true);
                            setInputMobile(mobileNumber);
                            setOtpSent(false);
                            setOtpCode('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.mobileChangeBtnText}>Change</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.mobileOtpCard}>
                        <View style={styles.mobileOtpHeader}>
                          <Text style={styles.mobileOtpTitle}>
                            Update Mobile Number
                          </Text>
                          <TouchableOpacity
                            onPress={handleCancelMobileEdit}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon name="close" size={20} color={colors.textSecondary} />
                          </TouchableOpacity>
                        </View>

                        <View style={styles.mobileInputRow}>
                          <View style={styles.countryCodeBadge}>
                            <Text style={styles.countryCodeText}>+91</Text>
                          </View>
                          <TextInput
                            style={styles.mobilePhoneInput}
                            placeholder="10-digit mobile number"
                            placeholderTextColor={colors.textTertiary}
                            value={inputMobile}
                            onChangeText={setInputMobile}
                            keyboardType="phone-pad"
                            maxLength={10}
                            editable={!otpSent}
                          />
                        </View>

                        {!otpSent ? (
                          <View style={styles.otpActionRow}>
                            <TouchableOpacity
                              style={styles.otpPrimaryBtn}
                              onPress={handleSendMobileOtp}
                              disabled={sendingOtp}
                              activeOpacity={0.8}
                            >
                              <LinearGradient
                                colors={[colors.action, colors.actionDark]}
                                style={StyleSheet.absoluteFill}
                              />
                              <Text style={styles.otpPrimaryBtnText}>
                                {sendingOtp ? 'Sending SMS…' : 'Send Verification OTP'}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.otpCancelBtn}
                              onPress={handleCancelMobileEdit}
                            >
                              <Text style={styles.otpCancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <View style={styles.otpVerificationContainer}>
                            <Text style={styles.otpSentNotice}>
                              Enter the 6-digit verification code sent to +91 {inputMobile}
                            </Text>
                            <TextInput
                              style={styles.otpCodeInput}
                              placeholder="• • • • • •"
                              placeholderTextColor={colors.textTertiary}
                              value={otpCode}
                              onChangeText={setOtpCode}
                              keyboardType="number-pad"
                              maxLength={6}
                              autoFocus
                            />

                            <View style={styles.resendRow}>
                              {otpTimer > 0 ? (
                                <Text style={styles.resendTimerText}>
                                  Resend code in {otpTimer}s
                                </Text>
                              ) : (
                                <TouchableOpacity
                                  onPress={handleSendMobileOtp}
                                  disabled={sendingOtp}
                                >
                                  <Text style={styles.resendActiveText}>
                                    Resend SMS Code
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>

                            <View style={styles.otpActionRow}>
                              <TouchableOpacity
                                style={styles.otpPrimaryBtn}
                                onPress={handleVerifyMobileOtp}
                                disabled={verifyingOtp}
                                activeOpacity={0.8}
                              >
                                <LinearGradient
                                  colors={[colors.action, colors.actionDark]}
                                  style={StyleSheet.absoluteFill}
                                />
                                <Text style={styles.otpPrimaryBtnText}>
                                  {verifyingOtp ? 'Verifying…' : 'Verify & Update'}
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.otpCancelBtn}
                                onPress={handleCancelMobileEdit}
                              >
                                <Text style={styles.otpCancelBtnText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
          </MotionView>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky Bottom Save Bar ── */}
      <View
        style={[
          styles.floatingSaveContainer,
          {
            bottom: keyboardHeight,
            paddingBottom:
              keyboardHeight > 0 ? 10 : Math.max(insets.bottom, 14),
          },
        ]}
      >
        <View style={[styles.saveBtnWrapper, isTablet && styles.constrained]}>
          <AppButton
            title="Save Profile"
            onPress={onSave}
            loading={loading}
            disabled={!draftReady || loading || uploadingPhotoIndex !== null || deletingPhoto}
            style={styles.saveBtn}
          />
        </View>
      </View>

      {/* Profile Photo Viewer Modal */}
      <ProfilePhotoViewerModal
        visible={Boolean(viewerPhoto)}
        onClose={() => setViewerPhoto(null)}
        photoUri={viewerPhoto?.uri}
        photoId={viewerPhoto?.id}
        onPhotoUpdated={newUri => {
          if (viewerPhoto) {
            setLocalPhotos(prev =>
              prev.map((p, i) => (i === viewerPhoto.index ? newUri : p)),
            );
          }
        }}
        onPhotoDeleted={() => {
          if (viewerPhoto) {
            setLocalPhotos(prev =>
              prev.filter((_, i) => i !== viewerPhoto.index),
            );
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Top Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: 'transparent',
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.roseBorder,
    ...shadow.sm,
  },
  headerTitleCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 1,
  },
  headerBtnSpacer: {
    width: 40,
  },

  tabBarWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: 'transparent',
    zIndex: 9,
  },
  tabRow: {
    gap: 8,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.roseBorder,
    ...shadow.sm,
  },
  activeChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.button,
  },
  tabChipIcon: {
    marginRight: 6,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  activeChipText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },

  // Card
  glassCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.roseBorder,
    marginBottom: 16,
    overflow: 'hidden',
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: '#FFFDFE',
  },
  cardHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderTextCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionBody: {
    padding: 18,
  },

  // Section Headers for Verification
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    backgroundColor: '#FFFDFE',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },

  // Inputs
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
    marginLeft: 2,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inputLabelFocused: {
    color: colors.primary,
  },
  inputContainer: {
    backgroundColor: '#FDFBFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  inputField: {
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  aboutInput: {
    minHeight: 110,
    textAlignVertical: 'top',
    paddingTop: 12,
  },

  // Choice Options
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  choiceChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FDFBFC',
    borderWidth: 1,
    borderColor: colors.border,
  },
  choiceChipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  choiceChipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  choiceChipTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },

  // Photos
  photoRow: {
    gap: 12,
    paddingVertical: 4,
  },
  photoTile: {
    width: 125,
    height: 165,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FBF8FA',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.roseBorder,
    ...shadow.sm,
  },
  photoTileImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoUploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#F59E0B',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(48, 36, 50, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoTile: {
    width: 125,
    height: 165,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  addPhotoCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.roseBorder,
    ...shadow.sm,
  },
  addPhotoText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  // Verification & Contact Section
  verifyDocBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  verifyDocTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  verifyDocSub: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  verifyDocBtn: {
    marginBottom: 16,
  },
  fieldHelperText: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: -8,
    marginBottom: 14,
    paddingHorizontal: 2,
    fontWeight: '500',
  },
  mobileSectionContainer: {
    marginTop: 4,
    marginBottom: 8,
  },
  mobileDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FDFBFC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  mobileDisplayLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  mobileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileDisplayText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.3,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  verifiedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
  },
  unverifiedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.warning,
    marginTop: 2,
  },
  mobileChangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  mobileChangeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  mobileOtpCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadow.sm,
  },
  mobileOtpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  mobileOtpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  mobileInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  countryCodeBadge: {
    backgroundColor: colors.surfaceTint,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.roseBorder,
  },
  countryCodeText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },
  mobilePhoneInput: {
    flex: 1,
    backgroundColor: '#FDFBFC',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.border,
  },
  otpActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  otpPrimaryBtn: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  otpCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3EEF1',
  },
  otpCancelBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  otpVerificationContainer: {
    marginTop: 6,
  },
  otpSentNotice: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  otpCodeInput: {
    backgroundColor: '#FDFBFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    marginBottom: 10,
  },
  resendRow: {
    alignItems: 'center',
    marginBottom: 10,
  },
  resendTimerText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  resendActiveText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '700',
  },

  // Bottom Floating Save Bar
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.roseBorder,
    zIndex: 10,
    ...shadow.md,
  },
  saveBtn: {
    ...shadow.button,
  },
  saveBtnWrapper: {
    width: '100%',
  },
  constrained: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  contentSmall: {
    paddingHorizontal: 12,
  },
});
