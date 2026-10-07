import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React,{ useEffect,useRef,useState } from 'react';
import {
Animated,
Easing,
Image,
KeyboardAvoidingView,
Platform,
Pressable,
ScrollView,
StatusBar,
StyleSheet,
Text,
TextInput,
TouchableOpacity,
View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { resetPasswordWithOtp,sendOtp } from '../../api/authService';
import AppButton from '../../components/AppButton';
import { AuthStackParamList } from '../../navigation/types';
import { colors,radii,spacing,typography } from '../../theme/theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;
type Step = 1 | 2 | 3;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwVisible, setPwVisible] = useState(false);
  const [confirmPwVisible, setConfirmPwVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [focusedField, setFocusedField] = useState<string>('');

  const mobileRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const confirmPasswordRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const otpRefs = useRef<any[]>([null, null, null, null, null, null]);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  const animateStep = () => {
    slideAnim.setValue(30);
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const goToStep = (s: Step) => {
    setStep(s);
    setError('');
    animateStep();
  };

  const onSendOtp = async () => {
    setError('');
    const cleanNumber = mobileNumber.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    try {
      await sendOtp(cleanNumber);
      setResendCountdown(60);
      goToStep(2);
    } catch (err: any) {
      let msg = 'Could not send SMS OTP.';
      if (typeof err?.detail === 'string') msg = err.detail;
      else if (typeof err?.message === 'string' && err.message)
        msg = err.message;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResetPassword = async () => {
    setError('');
    const enteredCode = otp.join('');
    if (enteredCode.length < 6) return setError('Enter the 6-digit OTP.');
    if (!newPassword || newPassword.length < 8)
      return setError('New password must be at least 8 characters.');
    if (newPassword !== confirmPassword)
      return setError('Passwords do not match.');

    setLoading(true);
    try {
      const cleanNumber = mobileNumber.replace(/\D/g, '');
      await resetPasswordWithOtp({
        identifier: cleanNumber,
        code: enteredCode,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      goToStep(3);
    } catch (err: any) {
      const msg =
        typeof err?.detail === 'string'
          ? err.detail
          : 'Invalid or expired OTP code.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onResend = async () => {
    if (resendCountdown > 0 || loading) return;
    setError('');
    setOtp(['', '', '', '', '', '']);
    setLoading(true);
    try {
      const cleanNumber = mobileNumber.replace(/\D/g, '');
      await sendOtp(cleanNumber);
      setResendCountdown(60);
    } catch {
      setError('Failed to resend SMS OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (text: string, index: number) => {
    const digitsOnly = text.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const newOtp = [...otp];
      const chars = digitsOnly.slice(0, 6).split('');
      chars.forEach((c, idx) => {
        if (idx < 6) newOtp[idx] = c;
      });
      setOtp(newOtp);
      const nextFocus = Math.min(chars.length, 5);
      otpRefs.current[nextFocus]?.focus();
      return;
    }
    const digit = digitsOnly.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      {/* Full Screen Background Image */}
      <Image
        source={require('../../assets/images/login_bg_indian_sunset.jpg')}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />

      {/* Dark Gradient Overlay to make text legible */}
      <LinearGradient
        colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.4, 0.8]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentContainerStyle={{ flexGrow: 1 }}
        >
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + spacing.md }]}
          onPress={() => (step === 1 ? navigation.goBack() : goToStep(1))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <View
          style={[
            styles.container,
            { paddingTop: insets.top + 60, paddingBottom: insets.bottom + spacing.xl },
          ]}
        >
          <View style={styles.brandContainer}>
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#FFF', marginTop: 8 }}>MyDear<Text style={{ color: '#FF1E66' }}>Partner</Text></Text>
          </View>

          {step !== 3 && (
            <View style={styles.stepIndicator}>
              {[1, 2].map(s => (
                <View
                  key={s}
                  style={[styles.stepDot, step >= s && styles.stepDotActive]}
                >
                  {step > s ? (
                    <Icon name="checkmark" size={14} color={colors.white} />
                  ) : (
                    <Text
                      style={[
                        styles.stepDotText,
                        step === s && { color: colors.white },
                      ]}
                    >
                      {s}
                    </Text>
                  )}
                </View>
              ))}
              <View
                style={[styles.stepLine, step >= 2 && styles.stepLineActive]}
              />
            </View>
          )}

          <Animated.View
            style={[
              styles.formContainer,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <LinearGradient
              colors={['rgba(255, 242, 246, 0.95)', 'rgba(255, 242, 246, 0.98)', '#FFF2F6']}
              style={[StyleSheet.absoluteFill, { borderRadius: 32 }]}
            />
            
            <View style={{ padding: 24, zIndex: 10 }}>
              {step === 1 && (
                <>
                  <View style={styles.headerArea}>
                    <View style={styles.eyebrowChip}>
                      <Icon name="key" size={14} color={colors.primary} />
                      <Text style={styles.eyebrowText}>RECOVERY</Text>
                    </View>
                    <Text style={styles.title}>Forgot Password?</Text>
                    <Text style={styles.subtitle}>
                      Enter your mobile number to receive an SMS OTP.
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => mobileRef.current?.focus()}
                    style={[
                      styles.inputWrapper,
                      focusedField === 'mobile' && styles.inputWrapperFocused,
                    ]}
                  >
                    <View style={styles.iconWrap}>
                      <Icon
                        name="call-outline"
                        size={20}
                        color={
                          focusedField === 'mobile'
                            ? colors.primary
                            : colors.textTertiary
                        }
                      />
                    </View>
                    <Text style={styles.countryCode}>+91</Text>
                    <View style={styles.vDivider} />
                    <TextInput
                      ref={mobileRef}
                      style={styles.inputText}
                      placeholder="Mobile Number"
                      placeholderTextColor={colors.textLight}
                      keyboardType="number-pad"
                      maxLength={10}
                      value={mobileNumber}
                      onChangeText={t => {
                        setMobileNumber(t.replace(/\D/g, '').slice(0, 10));
                        setError('');
                      }}
                      editable={!loading}
                      onFocus={() => setFocusedField('mobile')}
                      onBlur={() => setFocusedField('')}
                    />
                  </Pressable>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Icon name="alert-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <AppButton
                    title="Send SMS OTP"
                    onPress={onSendOtp}
                    loading={loading}
                    icon={<Icon name="arrow-forward" size={18} color={colors.white} />}
                    style={styles.ctaButton}
                  />

                  <TouchableOpacity
                    style={styles.loginBtn}
                    onPress={() => navigation.navigate('Login')}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="arrow-back-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text style={styles.loginBtnText}> Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              )}

              {step === 2 && (
                <>
                  <View style={styles.headerArea}>
                    <View style={styles.eyebrowChip}>
                      <Icon name="shield-checkmark" size={14} color={colors.primary} />
                      <Text style={styles.eyebrowText}>VERIFICATION</Text>
                    </View>
                    <Text style={styles.title}>Enter OTP</Text>
                    <Text style={styles.subtitle}>
                      Code sent to +91 {mobileNumber}
                    </Text>
                  </View>

                  <View style={styles.otpRow}>
                    {otp.map((digit, idx) => (
                      <TextInput
                        key={idx}
                        ref={r => {
                          otpRefs.current[idx] = r;
                        }}
                        style={[
                          styles.otpBox,
                          digit ? styles.otpBoxFilled : null,
                        ]}
                        value={digit}
                        onChangeText={t => handleOtpChange(t, idx)}
                        onKeyPress={e => handleOtpKeyPress(e, idx)}
                        keyboardType="number-pad"
                        maxLength={6}
                        textAlign="center"
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                      />
                    ))}
                  </View>

                  <View style={styles.resendRow}>
                    <Text style={styles.signupGray}>Didn't receive it? </Text>
                    <TouchableOpacity
                      onPress={onResend}
                      disabled={resendCountdown > 0 || loading}
                    >
                      <Text
                        style={[
                          styles.signupLink,
                          (resendCountdown > 0 || loading) && {
                            color: colors.textLight,
                          },
                        ]}
                      >
                        {resendCountdown > 0
                          ? `Resend in ${resendCountdown}s`
                          : 'Resend SMS'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Pressable
                    onPress={() => passwordRef.current?.focus()}
                    style={[
                      styles.inputWrapper,
                      focusedField === 'npass' && styles.inputWrapperFocused,
                      { marginTop: 10 },
                    ]}
                  >
                    <View style={styles.iconWrap}>
                      <Icon
                        name="lock-closed-outline"
                        size={20}
                        color={
                          focusedField === 'npass'
                            ? colors.primary
                            : colors.textTertiary
                        }
                      />
                    </View>
                    <TextInput
                      ref={passwordRef}
                      style={styles.inputText}
                      placeholder="New Password"
                      placeholderTextColor={colors.textLight}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!pwVisible}
                      onFocus={() => setFocusedField('npass')}
                      onBlur={() => setFocusedField('')}
                    />
                    <TouchableOpacity
                      onPress={() => setPwVisible(!pwVisible)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Icon
                        name={pwVisible ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </Pressable>

                  <Pressable
                    onPress={() => confirmPasswordRef.current?.focus()}
                    style={[
                      styles.inputWrapper,
                      focusedField === 'cpass' && styles.inputWrapperFocused,
                    ]}
                  >
                    <View style={styles.iconWrap}>
                      <Icon
                        name="lock-closed-outline"
                        size={20}
                        color={
                          focusedField === 'cpass'
                            ? colors.primary
                            : colors.textTertiary
                        }
                      />
                    </View>
                    <TextInput
                      ref={confirmPasswordRef}
                      style={styles.inputText}
                      placeholder="Confirm Password"
                      placeholderTextColor={colors.textLight}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry={!confirmPwVisible}
                      onFocus={() => setFocusedField('cpass')}
                      onBlur={() => setFocusedField('')}
                    />
                    <TouchableOpacity
                      onPress={() => setConfirmPwVisible(!confirmPwVisible)}
                      style={styles.eyeBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Icon
                        name={
                          confirmPwVisible ? 'eye-off-outline' : 'eye-outline'
                        }
                        size={20}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </Pressable>

                  {error ? (
                    <View style={styles.errorContainer}>
                      <Icon name="alert-circle-outline" size={16} color={colors.danger} />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  ) : null}

                  <AppButton
                    title="Reset Password"
                    onPress={onResetPassword}
                    loading={loading}
                    icon={<Icon name="checkmark-circle-outline" size={18} color={colors.white} />}
                    style={styles.ctaButton}
                  />
                </>
              )}

              {step === 3 && (
                <View style={styles.successContainer}>
                  <View style={styles.successIconCircle}>
                    <Icon name="checkmark" size={40} color={colors.white} />
                  </View>
                  <Text style={styles.title}>Password Reset!</Text>
                  <Text style={[styles.subtitle, { textAlign: 'center', marginBottom: spacing.xl }]}>
                    Your password has been successfully updated. You can now sign
                    in.
                  </Text>

                  <AppButton
                    title="Sign In Now"
                    onPress={() => navigation.navigate('Login')}
                    style={{ width: '100%' }}
                  />
                </View>
              )}
            </View>
          </Animated.View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    width: 40,
    height: 40,
    tintColor: '#FF1E66',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(197, 60, 102, 0.15)',
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  stepLine: {
    height: 2,
    width: 60,
    backgroundColor: 'rgba(197, 60, 102, 0.15)',
    marginHorizontal: -4,
    zIndex: 1,
  },
  stepLineActive: {
    backgroundColor: colors.primary,
  },
  formContainer: {
    flex: 1,
  },
  headerArea: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
    marginBottom: spacing.sm,
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#302432',
    letterSpacing: -0.8,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(197, 60, 102, 0.15)',
    height: 56,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  iconWrap: {
    marginRight: spacing.sm,
    width: 24,
    alignItems: 'center',
  },
  countryCode: {
    color: '#302432',
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginRight: 6,
  },
  vDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(197, 60, 102, 0.15)',
    marginRight: 10,
  },
  inputText: {
    flex: 1,
    color: '#302432',
    fontSize: typography.sizes.md,
    fontWeight: '500',
    paddingVertical: 0,
    height: '100%',
  },
  eyeBtn: {
    paddingHorizontal: 4,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: spacing.md,
  },
  otpBox: {
    width: 44,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'rgba(197, 60, 102, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    fontSize: 20,
    fontWeight: '700',
    color: '#302432',
    textAlign: 'center',
  },
  otpBoxFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceElevated,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  signupGray: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  signupLink: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
    color: colors.primary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },
  ctaButton: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: spacing.sm,
  },
  loginBtnText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
});
