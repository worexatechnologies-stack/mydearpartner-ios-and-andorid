import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import AuthImage from './AuthImage';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  visible: boolean;
  profileName: string;
  avatarUrl?: string | null;
  onClose: () => void;
  onStartChat?: () => void;
  isMutual?: boolean;
}

export default function MatchCelebrationModal({
  visible,
  profileName,
  avatarUrl,
  onClose,
  onStartChat,
  isMutual = false,
}: Props) {
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      triggerHaptic('success');
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.6);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Header Badge */}
          <LinearGradient
            colors={['#FF5C97', '#FF2D78']}
            style={styles.iconCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name={isMutual ? 'sparkles' : 'heart'} size={32} color="#FFF" />
          </LinearGradient>

          {/* Avatar Ring */}
          <View style={styles.avatarWrapper}>
            <LinearGradient
              colors={['#FF5C97', '#F59E0B']}
              style={styles.avatarGradientRing}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.avatarInner}>
                <AuthImage
                  source={{ uri: avatarUrl || undefined }}
                  style={styles.avatar}
                />
              </View>
            </LinearGradient>
          </View>

          {/* Texts */}
          <Text style={styles.title}>
            {isMutual ? "It's a Match! 🎉" : 'Interest Sent! 💖'}
          </Text>
          <Text style={styles.subtitle}>
            {isMutual
              ? `You and ${profileName} liked each other! Start the conversation today.`
              : `You took the first step with ${profileName}. We'll notify you when they respond!`}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            {isMutual && onStartChat ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => {
                  onClose();
                  onStartChat();
                }}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#FF5C97', '#FF2D78']}
                  style={styles.btnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Icon name="chatbubble" size={18} color="#FFF" style={{ marginRight: 8 }} />
                  <Text style={styles.primaryBtnText}>Send a Message</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryBtnText}>Keep Exploring ✨</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingTop: 36,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
  },
  iconCircle: {
    position: 'absolute',
    top: -28,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
    elevation: 6,
  },
  avatarWrapper: {
    marginVertical: 12,
  },
  avatarGradientRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  avatar: {
    width: 90,
    height: 90,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 24,
    gap: 10,
  },
  primaryBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#F8FAFC',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
});
