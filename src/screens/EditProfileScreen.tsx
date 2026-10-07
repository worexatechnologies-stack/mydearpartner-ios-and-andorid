import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ProfileService from '../api/profileService';
import AppButton from '../components/AppButton';
import AuthImage from '../components/AuthImage';
import { useAuth } from '../context/AuthContext';
import { PROFILE_PROMPTS, ProfilePrompt } from '../data/prompts';
import { RootStackParamList } from '../navigation/types';
import { getProfileChanges } from '../utils/profileChanges';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

const MAX_PHOTOS = 5;
const MAX_PROMPTS = 3;

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
      <LinearGradient
        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.01)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIconWrap}>
          <Icon name={icon} size={20} color="#FF1E66" />
        </View>
        <Text style={styles.sectionTitleText}>{title}</Text>
      </View>
      <Icon
        name={isExpanded ? 'chevron-up' : 'chevron-down'}
        size={24}
        color="#A1A1AA"
      />
    </TouchableOpacity>
  );
}

function GlassInput({ label, ...props }: TextInputProps & { label: string }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={styles.inputWrapper}>
      <Text style={[styles.inputLabel, isFocused && { color: '#FF1E66' }]}>
        {label}
      </Text>
      <View style={[styles.inputContainer, isFocused && styles.inputFocused]}>
        <TextInput
          {...props}
          style={[styles.inputField, props.style]}
          placeholderTextColor="#64748B"
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
  const profile = currentUser?.profile;

  // Form State
  const [name, setName] = useState(profile?.name ?? '');
  const [city, setCity] = useState(profile?.city ?? '');
  const [height, setHeight] = useState(profile?.height ?? '');
  const [about, setAbout] = useState(profile?.about ?? '');
  const [profession, setProfession] = useState(profile?.profession ?? '');
  const [company, setCompany] = useState(profile?.company ?? '');
  const [education, setEducation] = useState(profile?.education ?? '');
  const [income, setIncome] = useState(profile?.income ?? '');
  const [religion, setReligion] = useState(profile?.religion ?? '');
  const [motherTongue, setMotherTongue] = useState(profile?.motherTongue ?? '');
  const [horoscope, setHoroscope] = useState(profile?.horoscope ?? '');
  const [maritalStatus, setMaritalStatus] = useState(
    profile?.maritalStatus ?? '',
  );

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Accordion State
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    prompts: true,
    career: false,
    lifestyle: false,
  });

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
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      if (result.didCancel || !result.assets || result.assets.length === 0)
        return;
      const asset = result.assets[0];
      if (!asset.uri) return;

      const newIndex = localPhotos.length;
      setLocalPhotos(prev => [...prev, asset.uri!]);
      setUploadingPhotoIndex(newIndex);
      try {
        const uploadedPhoto = await ProfileService.uploadPhoto(
          asset.uri,
          asset.fileName || `photo-${Date.now()}.jpg`,
          asset.type || 'image/jpeg',
        );
        setLocalPhotos(prev =>
          prev.map((uri, i) => (i === newIndex ? uploadedPhoto.uri : uri)),
        );
        setPhotoIds(prev => ({
          ...prev,
          [uploadedPhoto.uri]: uploadedPhoto.id,
        }));
        if (uploadedPhoto.isPrimary) setPrimaryPhotoId(uploadedPhoto.id);
        if (refreshCurrentUser) await refreshCurrentUser();
      } catch (e: any) {
        setLocalPhotos(prev => prev.filter((_, i) => i !== newIndex));
        Alert.alert('Upload Failed', e?.message || 'Could not upload photo.');
      } finally {
        setUploadingPhotoIndex(null);
      }
    } catch {
      Alert.alert('Error', 'Could not open photo gallery.');
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

  // ── Prompts ──────────────────────────────────────────────────
  const [prompts, setPrompts] = useState<ProfilePrompt[]>(
    profile?.prompts ?? [],
  );
  const [showPromptPicker, setShowPromptPicker] = useState(false);
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(
    null,
  );
  const [promptAnswer, setPromptAnswer] = useState('');

  const usedQuestions = prompts.map(p => p.question);
  const availablePrompts = PROFILE_PROMPTS.filter(
    q => !usedQuestions.includes(q),
  );

  const handleSavePromptAnswer = () => {
    if (editingPromptIndex === null) return;
    if (!promptAnswer.trim()) {
      Alert.alert('Oops', 'Please write an answer for this prompt.');
      return;
    }
    setPrompts(prev =>
      prev.map((p, i) =>
        i === editingPromptIndex ? { ...p, answer: promptAnswer.trim() } : p,
      ),
    );
    setEditingPromptIndex(null);
  };

  // ── Save ─────────────────────────────────────────────────────
  const scrollY = useRef(new Animated.Value(0)).current;

  const onSave = async () => {
    if (uploadingPhotoIndex !== null || deletingPhoto) return;
    setError('');
    if (!name.trim() || !city.trim()) {
      setError('Please fill in at least name and city.');
      return;
    }
    setLoading(true);
    try {
      const changes = getProfileChanges(profile, {
        name: name.trim(),
        city: city.trim(),
        religion: religion.trim(),
        profession: profession.trim(),
        education: education.trim(),
        height: height.trim(),
        about: about.trim(),
        company: company.trim(),
        income: income.trim(),
        motherTongue: motherTongue.trim(),
        horoscope: horoscope.trim(),
        maritalStatus: maritalStatus.trim(),
        prompts: prompts.filter(p => p.answer.trim().length > 0),
      });
      if (Object.keys(changes).length > 0) await updateProfile(changes);
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
        colors={['#0F172A', '#1E293B']}
        style={StyleSheet.absoluteFill}
      />

      {/* ── Fancy Header ── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerBtnSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <Animated.ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
        >
          {/* ── Photo Gallery Section ── */}
          <View style={styles.glassCard}>
            <View style={styles.photoHeader}>
              <View>
                <Text style={styles.glassCardTitle}>Profile Photos</Text>
                <Text style={styles.glassCardSubtitle}>
                  {loadingGallery
                    ? 'Loading…'
                    : `${localPhotos.length} of ${maxPhotos} photos added`}
                </Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.photoRow}
            >
              {localPhotos.map((uri, index) => (
                <View key={index} style={styles.photoTile}>
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
                  >
                    <Icon name="close" size={14} color="#FFF" />
                  </TouchableOpacity>
                </View>
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
                  <LinearGradient
                    colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <Icon name="add" size={32} color="#FF1E66" />
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>

          {/* ── Personal Details ── */}
          <View style={styles.glassCard}>
            <SectionHeader
              title="Personal Details"
              icon="person-outline"
              isExpanded={expandedSections.personal}
              onPress={() => toggleSection('personal')}
            />
            {expandedSections.personal && (
              <View style={styles.sectionBody}>
                <GlassInput
                  label="Full Name"
                  value={name}
                  onChangeText={setName}
                />
                <GlassInput label="City" value={city} onChangeText={setCity} />
                <GlassInput
                  label="Height"
                  value={height}
                  onChangeText={setHeight}
                />
                <GlassInput
                  label="About You"
                  multiline
                  numberOfLines={4}
                  value={about}
                  onChangeText={setAbout}
                  style={styles.aboutInput}
                />
              </View>
            )}
          </View>

          {/* ── Prompts ── */}
          <View style={styles.glassCard}>
            <SectionHeader
              title="Profile Prompts"
              icon="chatbubbles-outline"
              isExpanded={expandedSections.prompts}
              onPress={() => toggleSection('prompts')}
            />
            {expandedSections.prompts && (
              <View style={styles.sectionBody}>
                {prompts.map((prompt, index) => (
                  <View key={index} style={styles.promptCard}>
                    <View style={styles.promptHeader}>
                      <Text style={styles.promptQuestion}>
                        {prompt.question}
                      </Text>
                      <TouchableOpacity
                        onPress={() =>
                          setPrompts(prev => prev.filter((_, i) => i !== index))
                        }
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Icon name="close-circle" size={20} color="#F87171" />
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setEditingPromptIndex(index);
                        setPromptAnswer(prompts[index].answer);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={
                          prompt.answer
                            ? styles.promptAnswer
                            : styles.promptAnswerPlaceholder
                        }
                      >
                        {prompt.answer || 'Tap to write your answer…'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {prompts.length < MAX_PROMPTS && (
                  <TouchableOpacity
                    style={styles.addPromptBtn}
                    onPress={() => setShowPromptPicker(true)}
                  >
                    <Icon
                      name="add-circle"
                      size={20}
                      color="#FF1E66"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.addPromptText}>Add Prompt</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* ── Career & Education ── */}
          <View style={styles.glassCard}>
            <SectionHeader
              title="Career & Education"
              icon="briefcase-outline"
              isExpanded={expandedSections.career}
              onPress={() => toggleSection('career')}
            />
            {expandedSections.career && (
              <View style={styles.sectionBody}>
                <GlassInput
                  label="Profession"
                  value={profession}
                  onChangeText={setProfession}
                />
                <GlassInput
                  label="Company"
                  value={company}
                  onChangeText={setCompany}
                />
                <GlassInput
                  label="Education"
                  value={education}
                  onChangeText={setEducation}
                />
                <GlassInput
                  label="Annual Income"
                  value={income}
                  onChangeText={setIncome}
                />
              </View>
            )}
          </View>

          {/* ── Cultural & Lifestyle ── */}
          <View style={styles.glassCard}>
            <SectionHeader
              title="Cultural & Lifestyle"
              icon="earth-outline"
              isExpanded={expandedSections.lifestyle}
              onPress={() => toggleSection('lifestyle')}
            />
            {expandedSections.lifestyle && (
              <View style={styles.sectionBody}>
                <GlassInput
                  label="Religion"
                  value={religion}
                  onChangeText={setReligion}
                />
                <GlassInput
                  label="Mother Tongue"
                  value={motherTongue}
                  onChangeText={setMotherTongue}
                />
                <GlassInput
                  label="Horoscope/Zodiac"
                  value={horoscope}
                  onChangeText={setHoroscope}
                />
                <GlassInput
                  label="Marital Status"
                  value={maritalStatus}
                  onChangeText={setMaritalStatus}
                />
              </View>
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* Floating Save Button */}
      <View
        style={[
          styles.floatingSaveContainer,
          { paddingBottom: insets.bottom || 24 },
        ]}
      >
        <AppButton
          title="Save Profile"
          onPress={onSave}
          loading={loading}
          disabled={uploadingPhotoIndex !== null || deletingPhoto}
          style={styles.saveBtn}
        />
      </View>

      {/* Modals for Prompts */}
      <Modal
        visible={showPromptPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPromptPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a Prompt</Text>
            <FlatList
              data={availablePrompts}
              keyExtractor={item => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.promptPickerItem}
                  onPress={() => {
                    setShowPromptPicker(false);
                    setEditingPromptIndex(prompts.length);
                    setPromptAnswer('');
                    setPrompts(prev => [
                      ...prev,
                      { question: item, answer: '' },
                    ]);
                  }}
                >
                  <Icon
                    name="chatbubble"
                    size={18}
                    color="#FF1E66"
                    style={{ marginRight: 12 }}
                  />
                  <Text style={styles.promptPickerText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              onPress={() => setShowPromptPicker(false)}
              style={styles.modalCloseBtnFull}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={editingPromptIndex !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingPromptIndex(null)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flex}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingPromptIndex !== null
                  ? prompts[editingPromptIndex]?.question
                  : ''}
              </Text>
              <TextInput
                style={styles.promptAnswerInput}
                value={promptAnswer}
                onChangeText={setPromptAnswer}
                placeholder="Write your answer…"
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={4}
                maxLength={200}
                autoFocus
              />
              <AppButton title="Save Answer" onPress={handleSavePromptAnswer} />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerBtn: { padding: 8, marginLeft: -8 },
  headerBtnSpacer: { width: 40 },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  content: {
    padding: 16,
    paddingTop: 24,
  },

  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
    overflow: 'hidden',
  },
  glassCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  glassCardSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // Section Headers
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 30, 102, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionBody: {
    padding: 20,
    paddingTop: 0,
  },

  // Custom Input
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 6,
    marginLeft: 4,
    fontWeight: '600',
  },
  inputContainer: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputFocused: {
    borderColor: '#FF1E66',
    backgroundColor: 'rgba(255,30,102,0.05)',
  },
  inputField: {
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    color: '#FFF',
    fontSize: 16,
  },
  aboutInput: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Photos
  photoHeader: {
    padding: 20,
    paddingBottom: 16,
  },
  photoRow: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  photoTile: {
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainPhotoBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#FF1E66',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePhotoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addPhotoTile: {
    width: 120,
    height: 160,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 30, 102, 0.4)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  // Prompts
  promptCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  promptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  promptQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF1E66',
    flex: 1,
    marginRight: 12,
  },
  promptAnswer: {
    fontSize: 16,
    color: '#FFF',
    fontWeight: '500',
    lineHeight: 24,
  },
  promptAnswerPlaceholder: {
    fontSize: 16,
    color: '#64748B',
    fontStyle: 'italic',
  },
  addPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 30, 102, 0.1)',
    marginTop: 8,
  },
  addPromptText: {
    color: '#FF1E66',
    fontSize: 15,
    fontWeight: '700',
  },

  error: {
    color: '#F87171',
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },

  floatingSaveContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#0F172A', // Match the dark background of the screen
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
    elevation: 10,
  },
  saveBtn: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 24,
  },
  promptPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  promptPickerText: {
    fontSize: 15,
    color: '#E2E8F0',
    flex: 1,
    fontWeight: '500',
  },
  promptAnswerInput: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 16,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalCloseBtnFull: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  modalCloseBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
