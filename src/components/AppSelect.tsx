import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { colors, radii, spacing, typeScale, typography } from '../theme/theme';

interface AppSelectProps {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  placeholder?: string;
  onSelect: (value: string) => void;
  error?: string;
}

export default function AppSelect({
  label,
  value,
  options,
  placeholder = 'Select',
  onSelect,
  error,
}: AppSelectProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, error ? styles.labelError : null]}>{label}</Text>
      <Pressable
        style={[styles.inputContainer, error ? styles.inputError : null]}
        onPress={() => setModalVisible(true)}
      >
        <Text style={[styles.valueText, !value && styles.placeholderText]}>
          {selectedLabel || placeholder}
        </Text>
        <ChevronDown color={colors.textTertiary} size={20} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <Pressable onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color={colors.text} size={24} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {options.map((option) => (
                <Pressable
                  key={option.label}
                  style={[
                    styles.optionBtn,
                    value === option.value && styles.optionBtnSelected,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      value === option.value && styles.optionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              <View style={{ height: spacing.xxl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typeScale.subtitle,
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  labelError: {
    color: colors.danger,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  inputError: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  valueText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.text,
  },
  placeholderText: {
    color: colors.textTertiary,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
    marginLeft: spacing.xs,
    fontWeight: typography.weights.medium,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '70%',
    padding: spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typeScale.title,
    fontSize: 20,
  },
  closeBtn: {
    padding: spacing.xs,
    marginRight: -spacing.xs,
  },
  optionBtn: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionBtnSelected: {
    backgroundColor: colors.primaryLight,
    borderBottomColor: 'transparent',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
  },
  optionText: {
    ...typeScale.body,
    fontWeight: typography.weights.medium,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
});
