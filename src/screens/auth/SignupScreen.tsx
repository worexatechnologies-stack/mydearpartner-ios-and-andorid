import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Calendar, Lock, Mail, MapPin, Phone, User as UserIcon, Check, ChevronDown, X } from 'lucide-react-native';
import AppButton from '../../components/AppButton';
import SafetyCenter, { SafetyPage } from '../../components/SafetyCenter';
import legal from '../../config/legal.json';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, radii, typeScale } from '../../theme/theme';
import { adultDateOfBirth } from '../../utils/ageEligibility';
import { saveSavedCredentials } from '../../utils/credentialStorage';

const PROFILE_FOR_OPTIONS = [
  { label: 'Myself', value: 'Self' },
  { label: 'My son', value: 'Parent' },
  { label: 'My daughter', value: 'Parent' },
  { label: 'My brother', value: 'Sibling' },
  { label: 'My sister', value: 'Sibling' },
  { label: 'A relative', value: 'Relative' },
  { label: 'A friend', value: 'Friend' },
];

const LANGUAGE_OPTIONS = [
  { label: 'Telugu', value: 'Telugu' },
  { label: 'Kannada', value: 'Kannada' },
  { label: 'Tamil', value: 'Tamil' },
  { label: 'Malayalam', value: 'Malayalam' },
  { label: 'Hindi', value: 'Hindi' },
  { label: 'Marathi', value: 'Marathi' },
  { label: 'Gujarati', value: 'Gujarati' },
  { label: 'Bengali', value: 'Bengali' },
  { label: 'Punjabi', value: 'Punjabi' },
  { label: 'Odia', value: 'Odia' },
  { label: 'Urdu', value: 'Urdu' },
  { label: 'Other', value: 'Other' },
];

function DarkInput({ icon, placeholder, ...rest }: any) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<any>(null);
  return (
    <Pressable
      style={[styles.inputContainer, isFocused && styles.inputContainerFocused]}
      onPress={() => inputRef.current?.focus()}
    >
      <View style={styles.inputIcon}>{icon}</View>
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.3)"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...rest}
      />
      {rest.rightElement}
    </Pressable>
  );
}

function DarkSelect({ icon, placeholder, value, options, onSelect }: any) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedLabel = options.find((o: any) => o.value === value)?.label || placeholder;
  return (
    <>
      <Pressable onPress={() => setModalVisible(true)} style={styles.inputContainer}>
        <View style={styles.inputIcon}>{icon}</View>
        <Text style={[styles.input, !value && { color: 'rgba(255,255,255,0.3)' }]}>{selectedLabel}</Text>
        <ChevronDown color="rgba(255,255,255,0.5)" size={20} />
      </Pressable>
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option: any) => (
                <Pressable
                  key={option.label}
                  style={[styles.optionBtn, value === option.value && styles.optionBtnSelected]}
                  onPress={() => { onSelect(option.value); setModalVisible(false); }}
                >
                  <Text style={[styles.optionText, value === option.value && styles.optionTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              <View style={{ height: spacing.xxl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { signup } = useAuth();
  
  const [profileFor, setProfileFor] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phone, setPhone] = useState('');
  const [motherTongue, setMotherTongue] = useState('');
  const [city, setCity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [safetyPage, setSafetyPage] = useState<SafetyPage | null>(null);
  const [agreed, setAgreed] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const submitting = useRef(false);

  const handleSignup = async () => {
    if (submitting.current) return;
    
    if (!profileFor) return Alert.alert('Missing Field', 'Please select who you are creating this profile for.');
    if (name.trim().length < 2) return Alert.alert('Missing Field', 'Please enter a valid full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Alert.alert('Check your email', 'Enter a valid email address.');
    
    const birthDate = adultDateOfBirth(dateOfBirth);
    if (!birthDate) return Alert.alert('Age requirement', 'Enter your date of birth as DD/MM/YYYY. You must be at least 18 to join.');
    if (phone.replace(/\D/g, '').length < 10) return Alert.alert('Check your mobile number', 'Enter a valid 10-digit mobile number.');
    if (!motherTongue) return Alert.alert('Missing Field', 'Please select your mother tongue.');
    if (city.trim().length < 2) return Alert.alert('Missing Field', 'Please enter your city.');
    if (password.length < 8) return Alert.alert('Check your password', 'Use at least 8 characters.');
    if (!agreed) return Alert.alert('Review our terms', 'Agree to the Terms of Service and Privacy Policy to continue.');
    
    submitting.current = true;
    setIsLoading(true);
    try {
      const parts = name.trim().split(/\s+/);
      const first_name = parts[0];
      const last_name = parts.slice(1).join(' ');

      const result = await signup(email.trim(), password, { 
        date_of_birth: birthDate, 
        policy_version: legal.version,
        accept_terms: agreed,
        mobile: phone.replace(/\D/g, ''),
        first_name,
        last_name,
        managed_by: profileFor,
        mother_tongue: motherTongue,
        city: city.trim(),
        gender: gender,
      });
      if (result.ok) {
        await saveSavedCredentials(email.trim(), password).catch(() => {});
      } else {
        Alert.alert('Could not create account', result.error || 'Please try again.');
      }
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={Platform.OS === 'ios' ? 20 : 0}
      >
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: height }}>
          {/* Full Screen Background Image */}
          <Image
            source={require('../../assets/images/login_bg_indian_sunset.jpg')}
            style={[StyleSheet.absoluteFill, { width: width, height: height }]}
            resizeMode="cover"
            pointerEvents="none"
          />

          {/* Dark Gradient Overlay */}
          <LinearGradient
            colors={['rgba(15,10,20,0.4)', 'rgba(10,5,15,0.7)', 'rgba(5,2,5,0.95)']}
            locations={[0, 0.3, 0.8]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </View>

        {/* Fixed Header & Top Copy */}
        <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, zIndex: 10 }}>
          <View style={[styles.header, { paddingHorizontal: 0, marginTop: 0 }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <Icon name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>
            <View style={styles.brand}>
              <Image source={require('../../assets/logo.png')} style={styles.brandLogo} resizeMode="contain" />
              <View>
                <Text style={styles.brandName}>MyDear<Text style={{ color: '#FF1E66' }}>Partner</Text></Text>
              </View>
            </View>
            <View style={styles.headerRight} />
          </View>

          <View style={[styles.copyContainer, { paddingHorizontal: 0, marginTop: 16 }]}>
            <Text style={styles.eyebrowText}>WELCOME</Text>
            <Text style={styles.title}>Create your</Text>
            <Text style={styles.titlePink}>account</Text>
            <Text style={styles.subtitle}>Start with the essentials. You can tell your story and add photos next.</Text>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />

        {/* Bottom Area */}
        <View style={styles.bottomArea}>
          <LinearGradient
            colors={['rgba(30, 20, 30, 0.85)', 'rgba(10, 5, 10, 0.98)', '#050205']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
          <View style={styles.glassBorderTop} pointerEvents="none" />
          
          <View style={styles.pinkGlow1} pointerEvents="none" />

          <View style={[styles.form, { paddingBottom: insets.bottom + spacing.xl }]}>
            
            <DarkSelect
              icon={<Icon name="people-outline" size={20} color="rgba(255,255,255,0.5)" />}

              placeholder="Creating profile for"
              value={profileFor}
              onSelect={setProfileFor}
              options={PROFILE_FOR_OPTIONS}
            />

            <DarkInput
              icon={<UserIcon color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="Full name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
              editable={!isLoading}
            />

            <View style={styles.genderRow}>
              {['male', 'female'].map((opt) => {
                const isSelected = gender === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setGender(opt as any)}
                    style={[styles.genderSelector, isSelected && styles.genderSelectorSelected]}
                  >
                    <Text style={[styles.genderText, isSelected && styles.genderTextSelected]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <DarkInput
              icon={<Mail color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="Email address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              autoComplete="email"
              importantForAutofill="yes"
              returnKeyType="next"
              editable={!isLoading}
            />

            <DarkInput
              icon={<Calendar color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="Date of birth (DD/MM/YYYY)"
              value={dateOfBirth}
              onChangeText={(text: string) => {
                let v = text.replace(/\D/g, '').slice(0, 8);
                if (v.length > 4) v = v.slice(0, 2) + '/' + v.slice(2, 4) + '/' + v.slice(4);
                else if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
                setDateOfBirth(v);
              }}
              maxLength={10}
              keyboardType="numeric"
              editable={!isLoading}
            />

            <DarkInput
              icon={<Phone color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="Mobile number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              importantForAutofill="yes"
              maxLength={10}
              editable={!isLoading}
              rightElement={<Text style={styles.phonePrefix}>+91</Text>}
            />

            <DarkSelect
              icon={<Icon name="language-outline" size={20} color="rgba(255,255,255,0.5)" />}
              placeholder="Mother tongue"
              value={motherTongue}
              onSelect={setMotherTongue}
              options={LANGUAGE_OPTIONS}
            />

            <DarkInput
              icon={<MapPin color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="City (e.g. Bengaluru)"
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              textContentType="addressCity"
              autoComplete="postal-address-locality"
              importantForAutofill="yes"
              editable={!isLoading}
            />

            <DarkInput
              icon={<Lock color="rgba(255,255,255,0.5)" size={20} />}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              importantForAutofill="yes"
              returnKeyType="done"
              editable={!isLoading}
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
                  <Icon name={showPassword ? 'eye-outline' : 'eye-off-outline'} size={20} color="rgba(255,255,255,0.5)" />
                </Pressable>
              }
            />

            <Pressable 
              accessibilityRole="checkbox"
              onPress={() => setAgreed(!agreed)} 
              style={styles.consentContainer}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
                {agreed && <Check color="#FFFFFF" size={14} strokeWidth={3} />}
              </View>
              <Text style={styles.consentText}>
                I agree to the <Text onPress={() => setSafetyPage('terms')} style={styles.linkText}>Terms</Text> and <Text onPress={() => setSafetyPage('safety')} style={styles.linkText}>Community & Child Safety Standards</Text>, and acknowledge the <Text onPress={() => setSafetyPage('privacy')} style={styles.linkText}>Privacy Policy</Text>.
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={handleSignup}
              disabled={isLoading}
              style={({ pressed }) => [
                styles.primaryBtnWrap,
                pressed && { transform: [{ scale: 0.96 }] },
                isLoading && { opacity: 0.7 },
                { marginTop: 12 }
              ]}
            >
              <LinearGradient
                colors={['#FF1E66', '#B21547']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <Text style={styles.primaryBtnText}>
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </Text>
              </LinearGradient>
            </Pressable>

            <View style={styles.formSpacer} />

            <Pressable onPress={() => navigation.navigate('Login')} style={styles.footer}>
              <Text style={styles.footerText}>
                Already a member? <Text style={styles.footerLink}>Sign In</Text> <Icon name="arrow-forward" size={12} color="#FF1E66" />
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollView>
      <SafetyCenter page={safetyPage} onClose={() => setSafetyPage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#050205' },
  scrollContent: { flexGrow: 1, minHeight: '100%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, width: '100%', maxWidth: 600, alignSelf: 'center',
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandLogo: { width: 28, height: 28, tintColor: '#FF1E66' },
  brandName: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  headerRight: { width: 44 },
  copyContainer: { paddingHorizontal: spacing.lg, marginTop: 40, width: '100%', maxWidth: 600, alignSelf: 'center' },
  eyebrowText: { fontSize: 12, fontWeight: '800', letterSpacing: 3, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 },
  title: { fontSize: 42, fontWeight: '900', letterSpacing: -1.5, color: '#FFFFFF', lineHeight: 46 },
  titlePink: {
    fontSize: 42, fontWeight: '900', letterSpacing: -1.5, color: '#FF1E66', lineHeight: 46, marginBottom: 12,
    textShadowColor: 'rgba(255, 30, 102, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16,
  },
  subtitle: { fontSize: 16, color: 'rgba(255, 255, 255, 0.75)', fontWeight: '500', lineHeight: 24 },
  spacer: { flex: 1, minHeight: 40 },
  bottomArea: { width: '100%', minHeight: '100%', position: 'relative', borderTopLeftRadius: 40, borderTopRightRadius: 40, overflow: 'hidden' },
  bottomGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  glassBorderTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.15)' },
  pinkGlow1: {
    position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: '#FF1E66',
    opacity: 0.1, top: 40, right: -80, transform: [{ rotate: '-30deg' }],
  },
  form: { paddingHorizontal: spacing.lg, paddingTop: 40, gap: 14, width: '100%', maxWidth: 500, alignSelf: 'center' },
  
  // Custom Dark Input Styles
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16, paddingHorizontal: 16, height: 56, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inputContainerFocused: {
    backgroundColor: 'rgba(255, 30, 102, 0.05)', borderColor: '#FF1E66',
    shadowColor: '#FF1E66', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, height: '100%', fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  phonePrefix: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 16 },
  
  // Custom Dark Select Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1A1118', borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, maxHeight: '70%', padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { ...typeScale.title, fontSize: 20, color: '#FFF' },
  closeBtn: { padding: spacing.xs, marginRight: -spacing.xs },
  optionBtn: { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  optionBtnSelected: { backgroundColor: 'rgba(255,30,102,0.15)', borderBottomColor: 'transparent', borderRadius: radii.sm, paddingHorizontal: spacing.sm, marginHorizontal: -spacing.sm },
  optionText: { ...typeScale.body, fontWeight: '500', color: '#FFF' },
  optionTextSelected: { color: '#FF1E66', fontWeight: '800' },

  // Form Elements
  genderRow: { flexDirection: 'row', gap: 12 },
  genderSelector: {
    flex: 1, height: 50, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  genderSelectorSelected: { borderColor: '#FF1E66', backgroundColor: 'rgba(255, 30, 102, 0.15)' },
  genderText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  genderTextSelected: { color: '#FF1E66' },

  consentContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', marginTop: 2 },
  checkboxActive: { backgroundColor: '#FF1E66', borderColor: '#FF1E66' },
  consentText: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 20 },
  linkText: { color: '#FF1E66', fontWeight: '700' },

  primaryBtnWrap: { borderRadius: 20, shadowColor: '#FF1E66', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8 },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', height: 60, borderRadius: 20 },
  primaryBtnText: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },
  formSpacer: { height: 24 },
  footer: { alignItems: 'center' },
  footerText: { fontSize: 15, color: 'rgba(255, 255, 255, 0.6)', fontWeight: '500' },
  footerLink: { color: '#FFFFFF', fontWeight: '800' },
});
