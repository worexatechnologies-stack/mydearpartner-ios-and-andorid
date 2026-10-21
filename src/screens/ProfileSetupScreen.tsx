import React,{ useState } from 'react';
import { KeyboardAvoidingView,Platform,ScrollView,StyleSheet,Text,TouchableOpacity,View } from 'react-native';
import AppButton from '../components/AppButton';
import AppTextInput from '../components/AppTextInput';
import AuthImage from '../components/AuthImage';
import ScreenContainer from '../components/ScreenContainer';
import { useAuth } from '../context/AuthContext';
import { colors,fontSizes,radii,spacing } from '../theme/theme';
import { Gender } from '../types/models';
import analyticsService from '../services/analyticsService';

const genderOptions: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
];

export default function ProfileSetupScreen() {
  const { completeProfile, currentUser } = useAuth();
  const profile = currentUser?.profile;

  const [name, setName] = useState(profile?.name || '');
  const [age, setAge] = useState(profile?.age ? profile.age.toString() : '');
  const [gender, setGender] = useState<Gender>(profile?.gender || 'female');
  const [city, setCity] = useState(profile?.city || '');
  const [religion, setReligion] = useState(profile?.religion || '');
  const [profession, setProfession] = useState(profile?.profession || '');
  const [education, setEducation] = useState(profile?.education || '');
  const [height, setHeight] = useState(profile?.height || '');
  const [about, setAbout] = useState(profile?.about || '');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddPhoto = async () => {
    if (uploadingPhoto) return;
    try {
      const { launchImageLibrary } = require('react-native-image-picker');
      const { COMPATIBLE_IMAGE_PICKER_OPTIONS } = require('../utils/profilePhotos');
      const result = await launchImageLibrary(COMPATIBLE_IMAGE_PICKER_OPTIONS);
      if (result.didCancel || !result.assets || result.assets.length === 0) return;
      
      const asset = result.assets[0];
      if (!asset.uri) return;
      
      setUploadingPhoto(true);
      setError('');
      try {
        const ProfileService = require('../api/profileService');
        await ProfileService.uploadPhoto(asset.uri, asset.fileName, asset.type);
        setPhotoUri(asset.uri);
      } catch (err: any) {
        setError(err?.message || 'Failed to upload photo.');
      } finally {
        setUploadingPhoto(false);
      }
    } catch {
      setError('Could not open photo gallery.');
    }
  };

  const onSubmit = async () => {
    setError('');
    const finalName = name.trim();
    const validAge = Number(age.trim());
    if (!finalName || !city.trim()) {
      setError('Name and city are required.');
      return;
    }
    if (
      !age.trim() ||
      !Number.isInteger(validAge) ||
      validAge < 18 ||
      validAge > 90
    ) {
      setError('Enter an age between 18 and 90.');
      return;
    }

    setLoading(true);
    try {
      await completeProfile({
        name: finalName,
        age: validAge,
        gender,
        city: city.trim(),
        religion: religion.trim(),
        profession: profession.trim(),
        education: education.trim(),
        height: height.trim(),
        about: about.trim(),
        photo: photoUri || profile?.photo || '',
        interests: [],
      });
      analyticsService.trackProfileComplete({ completion_version: 'v1' }).catch(() => {});
    } catch (err: any) {
      console.warn('[ProfileSetupScreen] onSubmit error:', err);
      setError(err?.message || 'Could not save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <Text style={styles.title}>Tell us about yourself</Text>
        <Text style={styles.subtitle}>
          This helps us find the most compatible matches for you.
        </Text>

        <View style={styles.photoContainer}>
          <TouchableOpacity 
            style={styles.photoUploadBtn} 
            onPress={handleAddPhoto}
            disabled={uploadingPhoto}
          >
            {photoUri || profile?.photo ? (
              <AuthImage 
                source={{ uri: photoUri || profile?.photo }} 
                style={styles.uploadedPhoto} 
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderIcon}>+</Text>
                <Text style={styles.photoPlaceholderText}>Add Photo</Text>
              </View>
            )}
            {uploadingPhoto && (
              <View style={styles.photoUploadingOverlay}>
                <Text style={styles.photoUploadingText}>Uploading...</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <AppTextInput
          label="Full Name"
          placeholder="Your name"
          value={name}
          onChangeText={setName}
        />
        <AppTextInput
          label="Age"
          placeholder="e.g. 28"
          keyboardType="number-pad"
          value={age}
          onChangeText={setAge}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {genderOptions.map(option => {
            const isSelected = gender === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.genderSelector,
                  isSelected && styles.genderSelectorSelected,
                ]}
                onPress={() => setGender(option.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.genderText,
                    isSelected && styles.genderTextSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <AppTextInput
          label="City"
          placeholder="e.g. Bengaluru"
          value={city}
          onChangeText={setCity}
        />
        <AppTextInput
          label="State"
          placeholder="State updates are currently unavailable"
          value={profile?.state || ''}
          editable={false}
        />
        <AppTextInput
          label="Religion"
          placeholder="e.g. Hindu"
          value={religion}
          onChangeText={setReligion}
        />
        <AppTextInput
          label="Profession"
          placeholder="e.g. Software Engineer"
          value={profession}
          onChangeText={setProfession}
        />
        <AppTextInput
          label="Education"
          placeholder="e.g. B.Tech"
          value={education}
          onChangeText={setEducation}
        />
        <AppTextInput
          label="Height"
          placeholder="e.g. 5'6&quot;"
          value={height}
          onChangeText={setHeight}
        />
        <AppTextInput
          label="About You"
          placeholder="Share a bit about yourself..."
          multiline
          numberOfLines={4}
          style={styles.about}
          value={about}
          onChangeText={setAbout}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          title="Save & Continue"
          onPress={onSubmit}
          loading={loading}
          style={styles.submitBtn}
        />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSizes.xxl + 2,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: spacing.xs,
    marginBottom: spacing.lg + 4,
    fontWeight: '500',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  photoUploadBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadedPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPlaceholderIcon: {
    fontSize: 32,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  photoPlaceholderText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  photoUploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoUploadingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: fontSizes.sm,
    color: colors.text,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  genderRow: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  genderSelector: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  genderSelectorSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  genderText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    color: colors.textLight,
  },
  genderTextSelected: {
    color: colors.primary,
  },
  about: {
    height: 110,
    textAlignVertical: 'top',
    borderRadius: radii.md,
  },
  submitBtn: {
    marginTop: spacing.lg,
  },
  error: {
    color: colors.danger,
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
});
