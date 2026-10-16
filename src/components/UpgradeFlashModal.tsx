import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../theme/theme';
import { triggerHaptic } from '../utils/haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  title?: string;
  subtitle?: string;
}

export default function UpgradeFlashModal({
  visible,
  onClose,
  onUpgrade,
  title = 'VIP Membership Flash Offer',
  subtitle = 'Find your perfect life partner up to 5x faster with verified direct connection.',
}: Props) {
  const { width } = useWindowDimensions();
  const modalWidth = Math.min(width - 40, 380);

  const handleUpgradePress = () => {
    triggerHaptic('medium');
    onClose();
    onUpgrade();
  };

  const handleClosePress = () => {
    triggerHaptic('light');
    onClose();
  };

  const perks = [
    {
      icon: 'chatbubbles',
      color: '#FF1E66',
      title: 'Unlimited Direct Messaging',
      desc: 'Start conversations without waiting for mutual match acceptance',
    },
    {
      icon: 'call',
      color: '#10B981',
      title: 'Direct Phone & WhatsApp',
      desc: 'Unlock direct contact details of verified prospective matches',
    },
    {
      icon: 'eye',
      color: '#3B82F6',
      title: 'See Profile Visitors',
      desc: 'Find out who viewed your profile and interest in real-time',
    },
    {
      icon: 'shield-checkmark',
      color: '#F59E0B',
      title: 'VIP Verified Badge',
      desc: 'Stand out at the top of partner searches and match recommendations',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClosePress}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { width: modalWidth }]}>
          {/* Background Glow & Gradient */}
          <LinearGradient
            colors={['#2D0E25', '#160814', '#0A030A']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.borderGlow} />

          {/* Close Icon */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleClosePress}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Close offer"
          >
            <Icon name="close" size={20} color="rgba(255, 255, 255, 0.6)" />
          </TouchableOpacity>

          {/* Top VIP Badge */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#FF1E66', '#FF8C42']}
              style={styles.vipPill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Icon name="diamond" size={13} color="#FFFFFF" />
              <Text style={styles.vipPillText}>SPECIAL FLASH OFFER</Text>
            </LinearGradient>

            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Perks List */}
          <View style={styles.perksList}>
            {perks.map((item, index) => (
              <View key={index} style={styles.perkRow}>
                <View
                  style={[
                    styles.perkIconWrap,
                    { backgroundColor: `${item.color}20` },
                  ]}
                >
                  <Icon name={item.icon} size={18} color={item.color} />
                </View>
                <View style={styles.perkTextWrap}>
                  <Text style={styles.perkTitle}>{item.title}</Text>
                  <Text style={styles.perkDesc}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleUpgradePress}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="View VIP Membership Plans"
          >
            <LinearGradient
              colors={['#FF1E66', '#B21547']}
              style={styles.actionGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Icon name="diamond-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Explore VIP Plans</Text>
              <Icon name="arrow-forward" size={16} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterBtn}
            onPress={handleClosePress}
            activeOpacity={0.7}
          >
            <Text style={styles.laterText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  borderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 30, 102, 0.35)',
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  vipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  vipPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.65)',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  perksList: {
    width: '100%',
    gap: 14,
    marginBottom: 24,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  perkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  perkTextWrap: {
    flex: 1,
  },
  perkTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  perkDesc: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 16,
  },
  actionBtn: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#FF1E66',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 8,
  },
  actionBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  laterBtn: {
    paddingVertical: 10,
    marginTop: 8,
  },
  laterText: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 13,
    fontWeight: '600',
  },
});
