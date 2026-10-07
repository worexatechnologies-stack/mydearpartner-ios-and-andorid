import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
Image,
Pressable,
ScrollView,
StatusBar,
StyleSheet,
Text,
View,
useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { AuthStackParamList } from '../../navigation/types';
import { colors,radii,spacing } from '../../theme/theme';

export default function WelcomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<AuthStackParamList, 'Welcome'>>();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" />
      
      {/* Top Wavy Background - positioned at top right */}
      <Image 
        source={require('../../assets/images/welcome_bg_wavy.jpg')}
        style={[styles.topWavyBg, { width: width, height: width * 1.2 }]}
        resizeMode="cover"
      />
      {/* Fade the bottom of the wavy bg into the solid screen background */}
      <LinearGradient
        colors={['rgba(255, 242, 246, 0)', '#FFF2F6']}
        style={[StyleSheet.absoluteFill, { top: width * 0.8, height: width * 0.4 }]}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.md }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Header */}
        <View style={[styles.header, { marginTop: insets.top + spacing.sm }]}>
          <View style={styles.brand}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.brandName}>MyDear<Text style={{ color: colors.primary }}>Partner</Text></Text>
              <Text style={styles.brandTagline}>REAL PEOPLE. REAL CONNECTIONS.</Text>
            </View>
          </View>
          <Pressable style={styles.langSelector}>
            <Icon name="globe-outline" size={12} color={colors.primary} />
            <Text style={styles.langText}>English</Text>
            <Icon name="chevron-down" size={10} color={colors.textSecondary} />
          </Pressable>
        </View>

        {/* Hero Copy */}
        <View style={styles.copy}>
          <Text style={styles.eyebrowText}>WELCOME TO</Text>
          <Text style={styles.title}>Find your soulmate.</Text>
          <Text style={[styles.title, { color: colors.primary }]}>A lifetime of love.</Text>
          
          <Text style={styles.description}>
            Where meaningful connections turn into beautiful marriages. Meet the one who shares your idea of forever.
          </Text>

          {/* Features Row */}
          <View style={styles.featuresRow}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Icon name="shield-checkmark" size={16} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>Verified{'\n'}Profiles</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Icon name="heart" size={16} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>True{'\n'}Compatibility</Text>
            </View>
            <View style={styles.featureItem}>
              <View style={styles.featureIconWrap}>
                <Icon name="people" size={16} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>Real{'\n'}Conversations</Text>
            </View>
          </View>
        </View>

        {/* Seamless Blended Image Container */}
        <View style={styles.heroWrapper}>
          <View style={[styles.heroImageContainer, { height: width * 0.95 }]}>
            <Image
              source={require('../../assets/images/welcome_marriage.jpg')}
              style={styles.heroImage}
              resizeMode="cover"
            />
            
            {/* White drawn hearts overlay (simulated with icons) */}
            <Icon name="heart-outline" size={24} color="rgba(255,255,255,0.7)" style={{ position: 'absolute', left: 30, top: 50, transform: [{ rotate: '-15deg' }] }} />
            <Icon name="heart-outline" size={32} color="rgba(255,255,255,0.6)" style={{ position: 'absolute', right: 40, top: 30, transform: [{ rotate: '20deg' }] }} />
            <Icon name="heart-outline" size={16} color="rgba(255,255,255,0.8)" style={{ position: 'absolute', right: 20, top: 70, transform: [{ rotate: '10deg' }] }} />

            {/* Top Fade to Background Color */}
            <LinearGradient
              colors={['#FFF2F6', 'rgba(255, 242, 246, 0.7)', 'rgba(255, 242, 246, 0)']}
              style={[StyleSheet.absoluteFill, { height: 100 }]}
            />
            {/* Bottom Fade to Background Color */}
            <LinearGradient
              colors={['rgba(255, 242, 246, 0)', 'rgba(255, 242, 246, 0.9)', '#FFF2F6']}
              style={[StyleSheet.absoluteFill, { top: '65%' }]}
            />
          </View>

          {/* Glassmorphism Floating Card */}
          <View style={styles.floatingCard}>
            <View style={styles.floatingCardIcon}>
              <Icon name="heart" size={18} color={colors.white} />
            </View>
            <View style={styles.floatingCardTextWrap}>
              <Text style={styles.floatingCardTitle}>A little hello.</Text>
              <Text style={styles.floatingCardSub}>A beautiful marriage.</Text>
            </View>
            <View style={styles.paginationDots}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
              <View style={styles.dot} />
            </View>
          </View>
        </View>

        {/* Buttons and Footer */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate('Signup')}
            style={({ pressed }) => [styles.primaryBtnWrap, pressed && { transform: [{ scale: 0.98 }] }]}
          >
            <LinearGradient
              colors={['#A52A55', '#7A1C3C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <View style={styles.btnIconLeft}>
                <Icon name="arrow-forward" size={18} color="#302432" />
              </View>
              <Text style={styles.primaryBtnText}>Find your soulmate</Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('Login')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { backgroundColor: 'rgba(197, 60, 102, 0.05)' }]}
          >
            <Icon name="log-in-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={styles.secondaryBtnText}>Sign in to your account</Text>
          </Pressable>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFF2F6',
  },
  topWavyBg: {
    position: 'absolute',
    top: 0,
    right: 0,
    opacity: 0.8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#302432',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 7,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(197, 60, 102, 0.2)',
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#302432',
  },
  copy: {
    zIndex: 10,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.primary,
    marginBottom: 8,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '900',
    letterSpacing: -1.2,
    color: '#302432',
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 16,
    fontWeight: '500',
  },
  featuresRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FCE7EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#302432',
    textAlign: 'center',
    lineHeight: 14,
  },
  heroWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
    zIndex: 5,
    minHeight: 220,
    justifyContent: 'center',
  },
  heroImageContainer: {
    width: '120%', // Slightly wider than screen to bleed edges
    left: '-10%',
    position: 'absolute',
    top: 0,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  floatingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    width: '92%',
    shadowColor: '#302432',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    marginTop: 'auto', // Pushes card to bottom of wrapper
    marginBottom: 10,
  },
  floatingCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF6B9E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  floatingCardTextWrap: {
    flex: 1,
  },
  floatingCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#302432',
    marginBottom: 2,
  },
  floatingCardSub: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  paginationDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(197, 60, 102, 0.3)',
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  actions: {
    zIndex: 10,
    gap: 12,
  },
  primaryBtnWrap: {
    borderRadius: radii.pill,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radii.pill,
    paddingHorizontal: 20,
  },
  btnIconLeft: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    left: 14,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.white,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
});
