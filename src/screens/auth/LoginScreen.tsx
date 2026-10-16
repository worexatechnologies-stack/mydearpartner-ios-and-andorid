import React, { useState, useRef, useEffect } from 'react';

import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
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
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList } from '../../navigation/types';
import { colors, spacing } from '../../theme/theme';
import {
  getSavedCredentials,
  saveSavedCredentials,
  clearSavedCredentials,
} from '../../utils/credentialStorage';

export default function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { login } = useAuth();

  const submitting = useRef(false);
  const passwordInputRef = useRef<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saveCredentials, setSaveCredentials] = useState(true);
  const [hasLoadedSaved, setHasLoadedSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getSavedCredentials().then(saved => {
      if (isMounted && saved) {
        setEmail(saved.username);
        setPassword(saved.password);
        setHasLoadedSaved(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async () => {
    if (submitting.current) return;
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    submitting.current = true;
    setIsLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result.ok) {
        if (saveCredentials) {
          await saveSavedCredentials(email.trim(), password);
        } else {
          await clearSavedCredentials();
        }
      } else {
        Alert.alert('Login Failed', result.error || 'Invalid credentials');
      }
    } catch {
      Alert.alert('Could not sign in', 'Check your connection and try again.');
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" />

      {/* Full Screen Background Image */}
      <Image
        source={require('../../assets/images/login_bg_indian_sunset.jpg')}
        style={[StyleSheet.absoluteFill, { width: width, height: height }]}
        resizeMode="cover"
        pointerEvents="none"
      />

      {/* Dark Gradient Overlay to make text legible */}
      <LinearGradient
        colors={['rgba(15,10,20,0.4)', 'rgba(10,5,15,0.6)', 'rgba(5,2,5,0.9)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + spacing.md },
          ]}
          showsVerticalScrollIndicator={false}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.backBtn}
            >
              <Icon name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>

            <View style={styles.brand}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandName}>
                  MyDear<Text style={{ color: '#FF1E66' }}>Partner</Text>
                </Text>
                <Text style={styles.brandTagline}>
                  REAL PEOPLE. REAL CONNECTIONS.
                </Text>
              </View>
            </View>

            <View style={styles.headerRight} />
          </View>

          {/* Decorative Quote */}
          <View style={styles.quoteWrapper}>
            <Text style={styles.quoteText}>
              Better{'\n'}People{'\n'}Brighter{'\n'}Stories
            </Text>
            <Icon
              name="heart-outline"
              size={24}
              color="#FF1E66"
              style={styles.quoteHeart}
            />
          </View>

          {/* Top Copy */}
          <View style={styles.copyContainer}>
            <Text style={styles.eyebrowText}>WELCOME BACK</Text>
            <Text style={styles.title}>Sign in to your</Text>
            <Text style={styles.titlePink}>account</Text>
            <Text style={styles.subtitle}>
              Continue your journey to find{'\n'}your perfect match.
            </Text>
          </View>

          <View style={styles.spacer} />

          {/* Bottom Glassmorphism/Gradient Area */}
          <View style={styles.bottomArea}>
            {/* Dark Frosted Glass Background */}
            <LinearGradient
              colors={[
                'rgba(30, 20, 30, 0.75)',
                'rgba(10, 5, 10, 0.95)',
                '#050205',
              ]}
              style={styles.bottomGradient}
              pointerEvents="none"
            />

            {/* Top Border Glow for Glassmorphism */}
            <View style={styles.glassBorderTop} pointerEvents="none" />

            {/* Pink glow blobs for ambient lighting behind the form */}
            <View style={styles.pinkGlow1} pointerEvents="none" />
            <View style={styles.pinkGlow2} pointerEvents="none" />

            <View
              style={[
                styles.form,
                { paddingBottom: insets.bottom + spacing.xl },
              ]}
            >
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Icon
                  name="mail-outline"
                  size={20}
                  color="rgba(255,255,255,0.5)"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Email or Mobile Number"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                  textContentType="username"
                  autoComplete="username"
                  importantForAutofill="yes"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  accessibilityLabel="Email or mobile number"
                  editable={!isLoading}
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <Icon
                  name="lock-closed-outline"
                  size={20}
                  color="rgba(255,255,255,0.5)"
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  autoComplete="current-password"
                  importantForAutofill="yes"
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                  accessibilityLabel="Password"
                  editable={!isLoading}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? 'Hide password' : 'Show password'
                  }
                  hitSlop={8}
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Icon
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="rgba(255,255,255,0.5)"
                  />
                </Pressable>
              </View>

              {hasLoadedSaved && (
                <View style={styles.savedChip}>
                  <Icon name="shield-checkmark" size={14} color="#10B981" />
                  <Text style={styles.savedChipText}>
                    Autofill ready from {Platform.OS === 'ios' ? 'iCloud Keychain' : 'Google Password Saver'}
                  </Text>
                </View>
              )}

              <View style={styles.authOptionsRow}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: saveCredentials }}
                  accessibilityLabel="Save credentials with Google Password Manager and Apple Keychain"
                  onPress={() => setSaveCredentials(!saveCredentials)}
                  style={styles.saveCredentialsBtn}
                >
                  <Icon
                    name={saveCredentials ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={saveCredentials ? '#FF1E66' : 'rgba(255,255,255,0.5)'}
                  />
                  <Text style={styles.saveCredentialsText}>
                    Save with {Platform.OS === 'ios' ? 'iCloud Keychain' : 'Google Saver'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => navigation.navigate('ForgotPassword')}
                  style={styles.forgotBtn}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </Pressable>
              </View>

              {/* Glowing Sign In Button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in"
                accessibilityState={{ busy: isLoading, disabled: isLoading }}
                onPress={handleLogin}
                disabled={isLoading}
                style={({ pressed }) => [
                  styles.primaryBtnWrap,
                  pressed && { transform: [{ scale: 0.96 }] },
                  isLoading && { opacity: 0.7 },
                ]}
              >
                <LinearGradient
                  colors={['#FF1E66', '#B21547']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.primaryBtn}
                >
                  <Icon
                    name="arrow-forward"
                    size={18}
                    color={colors.white}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.primaryBtnText}>
                    {isLoading ? 'Signing In...' : 'Sign In'}
                  </Text>
                </LinearGradient>
              </Pressable>

              <View style={styles.formSpacer} />

              <Pressable
                onPress={() => navigation.navigate('Signup')}
                style={styles.footer}
              >
                <Text style={styles.footerText}>
                  Don't have an account?{' '}
                  <Text style={styles.footerLink}>Create Account</Text>{' '}
                  <Icon name="arrow-forward" size={12} color="#FF1E66" />
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#050205',
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 28,
    height: 28,
    tintColor: '#FF1E66',
  },
  brandName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 6,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 2,
    marginTop: 2,
  },
  headerRight: {
    width: 44,
  },
  quoteWrapper: {
    position: 'absolute',
    top: 120,
    right: 32,
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  quoteText: {
    fontFamily: Platform.OS === 'ios' ? 'Snell Roundhand' : 'sans-serif-medium',
    fontSize: 26,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'right',
    fontStyle: 'italic',
    lineHeight: 28,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  quoteHeart: {
    marginTop: -8,
    marginRight: -10,
    transform: [{ rotate: '15deg' }],
  },
  copyContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: 180,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  eyebrowText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: '#FFFFFF',
    lineHeight: 46,
  },
  titlePink: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
    color: '#FF1E66',
    lineHeight: 46,
    marginBottom: 12,
    textShadowColor: 'rgba(255, 30, 102, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '500',
    lineHeight: 24,
  },
  spacer: {
    flex: 1,
    minHeight: 40,
  },
  bottomArea: {
    width: '100%',
    position: 'relative',
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    overflow: 'hidden',
  },
  bottomGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
  },
  glassBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  pinkGlow1: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FF1E66',
    opacity: 0.15,
    bottom: -50,
    left: -80,
    transform: [{ rotate: '-30deg' }],
  },
  pinkGlow2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#FF1E66',
    opacity: 0.12,
    top: 20,
    right: -60,
  },
  form: {
    paddingHorizontal: spacing.lg,
    paddingTop: 48,
    gap: 16,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    paddingHorizontal: 18,
    height: 60,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  inputContainerFocused: {
    backgroundColor: 'rgba(255, 30, 102, 0.05)',
    borderColor: '#FF1E66',
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eyeBtn: {
    padding: 8,
  },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    gap: 6,
    marginTop: -4,
  },
  savedChipText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '600',
  },
  authOptionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saveCredentialsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  saveCredentialsText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    fontWeight: '500',
  },
  forgotBtn: {
    paddingVertical: 4,
  },
  forgotText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
    fontSize: 13,
  },
  primaryBtnWrap: {
    borderRadius: 20,
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    borderRadius: 20,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
  },
  formSpacer: {
    height: 30,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
  footerLink: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
