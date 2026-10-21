/**
 * QuickReplyBar — Suggested icebreakers and contextual smart replies for ChatScreen.
 *
 * Categorized by:
 * - Icebreakers (for fresh connections)
 * - Questions (to spark deep conversations)
 * - Quick Replies (instant polite & engaging responses)
 */
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { radii } from '../theme/theme';
import { triggerHaptic } from '../utils/haptics';

interface QuickReplyBarProps {
  onSelectPrompt: (prompt: string) => void;
  partnerName?: string;
  isNewConversation?: boolean;
}

type CategoryType = 'icebreakers' | 'questions' | 'quick';

export default function QuickReplyBar({
  onSelectPrompt,
  partnerName,
  isNewConversation = false,
}: QuickReplyBarProps) {
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(
    isNewConversation ? 'icebreakers' : 'quick',
  );
  const [isCollapsed, setIsCollapsed] = useState(false);

  const firstName = partnerName ? partnerName.split(' ')[0] : 'there';

  const PROMPTS: Record<CategoryType, string[]> = {
    icebreakers: [
      `👋 Hi ${firstName}! Loved your profile!`,
      "What's your dream vacation spot?",
      '☕ Coffee or Chai? How do you start your day?',
      '🎬 Any good movie or show recommendations lately?',
      '💍 What values matter most to you in a life partner?',
    ],
    questions: [
      'What does a relaxing weekend look like for you?',
      'How would your closest friends describe you?',
      'What are you most passionate about right now?',
      'What is your favorite family tradition?',
      'Do you prefer cozy nights in or exploring the city?',
    ],
    quick: [
      'Sounds great! 😊',
      "I'd love to hear more about that!",
      'Haha that is so true! 🙌',
      'When are you free for a call this week?',
      'Thank you so much! Wishing you a great day.',
      'That makes total sense to me.',
    ],
  };

  const categories: { id: CategoryType; label: string; icon: string }[] = [
    { id: 'quick', label: 'Quick', icon: 'flash' },
    { id: 'icebreakers', label: 'Icebreakers', icon: 'heart' },
    { id: 'questions', label: 'Questions', icon: 'help-circle' },
  ];

  if (isCollapsed) {
    return (
      <View style={styles.collapsedBar}>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => {
            triggerHaptic('light');
            setIsCollapsed(false);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Show smart replies"
        >
          <Icon name="sparkles" size={14} color="#FF5C97" style={{ marginRight: 6 }} />
          <Text style={styles.expandButtonText}>Suggested Replies</Text>
          <Icon name="chevron-up" size={14} color="#FF5C97" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryTabs}
        >
          {categories.map(cat => {
            const isActive = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => {
                  triggerHaptic('light');
                  setSelectedCategory(cat.id);
                }}
                style={[
                  styles.categoryTab,
                  isActive && styles.categoryTabActive,
                ]}
                activeOpacity={0.8}
              >
                <Icon
                  name={cat.icon}
                  size={12}
                  color={isActive ? '#FF2D78' : '#94A3B8'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.categoryTabText,
                    isActive && styles.categoryTabTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={() => {
            triggerHaptic('light');
            setIsCollapsed(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Hide smart replies"
        >
          <Icon name="chevron-down" size={16} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
        keyboardShouldPersistTaps="handled"
      >
        {PROMPTS[selectedCategory].map((prompt, idx) => (
          <TouchableOpacity
            key={idx}
            style={styles.chip}
            onPress={() => {
              triggerHaptic('light');
              onSelectPrompt(prompt);
            }}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Send suggestion: ${prompt}`}
          >
            <Text style={styles.chipText}>{prompt}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(26, 11, 21, 0.95)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  categoryTabs: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  categoryTabActive: {
    backgroundColor: 'rgba(255, 45, 120, 0.15)',
    borderColor: 'rgba(255, 45, 120, 0.3)',
    borderWidth: 1,
  },
  categoryTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  categoryTabTextActive: {
    color: '#FF2D78',
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 6,
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 8,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 151, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    maxWidth: 280,
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  collapsedBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 92, 151, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255, 92, 151, 0.25)',
  },
  expandButtonText: {
    color: '#FF5C97',
    fontSize: 11,
    fontWeight: '600',
  },
});
