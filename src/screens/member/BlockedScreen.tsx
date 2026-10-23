import BufferingIndicator from '../../components/BufferingIndicator';
import React, { useEffect, useState } from 'react';
import {
  
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { blockService } from '../../api/blockService';
import AuthImage from '../../components/AuthImage';
import EmptyState from '../../components/EmptyState';
import ScreenContainer from '../../components/ScreenContainer';
import { useAppData } from '../../context/AppDataContext';
import { colors, fontSizes, radii, shadow, spacing } from '../../theme/theme';
import { Profile } from '../../types/models';

type Tab = 'blocked' | 'matches';

export default function BlockedScreen() {
  const {
    chats,
    sentInterests,
    receivedInterests,
    getProfileById,
    blockedIds,
    blockUser,
    unblockUser,
  } = useAppData();
  const [activeTab, setActiveTab] = useState<Tab>('blocked');
  const [blockedList, setBlockedList] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load blocked profiles on mount and whenever blockedIds changes
  useEffect(() => {
    loadBlockedUsers();
  }, []);

  // Sync local blockedList when global blockedIds changes (e.g. blocked from ChatScreen)
  useEffect(() => {
    setBlockedList(prev => prev.filter(p => blockedIds.has(p.id)));
  }, [blockedIds]);

  const loadBlockedUsers = async () => {
    try {
      const data = await blockService.getBlockedUsers();
      setBlockedList(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  };

  // Build list of matched / accepted profiles from chats + accepted interests
  const allMatchedProfiles: Profile[] = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Profile[] = [];

    chats.forEach(chat => {
      if (chat.otherProfile && !seen.has(chat.otherProfile.id)) {
        seen.add(chat.otherProfile.id);
        result.push(chat.otherProfile);
      }
    });

    const allInterests = [...sentInterests, ...receivedInterests];
    allInterests.forEach(interest => {
      if (interest.status !== 'accepted') return;
      const profile =
        interest.senderProfile ??
        interest.receiverProfile ??
        getProfileById(interest.fromUserId) ??
        getProfileById(interest.toUserId);
      if (profile && !seen.has(profile.id)) {
        seen.add(profile.id);
        result.push(profile);
      }
    });

    // Also include anyone in blockedList who was a match (from original full chats)
    blockedList.forEach(p => {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        result.push(p);
      }
    });

    return result;
  }, [chats, sentInterests, receivedInterests, getProfileById, blockedList]);

  const handleBlock = (item: Profile) => {
    Alert.alert(
      'Block Member',
      `Are you sure you want to block ${item.name}?\n\nThey will no longer be able to see your profile or message you. Your chat history is preserved and will reappear if you unblock.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(item.id);
              setBlockedList(prev => {
                if (prev.some(p => p.id === item.id)) return prev;
                return [...prev, item];
              });
              Alert.alert('Blocked', `${item.name} has been blocked.`);
            } catch {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ],
    );
  };

  const handleUnblock = (item: Profile) => {
    Alert.alert(
      'Unblock Member',
      `Are you sure you want to unblock ${item.name}?\n\nAll previous messages will be visible again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser(item.id);
              setBlockedList(prev => prev.filter(b => b.id !== item.id));
              Alert.alert(
                'Unblocked',
                `${item.name} has been unblocked. All previous messages are now visible.`,
              );
            } catch {
              Alert.alert('Error', 'Failed to unblock user.');
            }
          },
        },
      ],
    );
  };

  const renderProfileCard = (item: Profile, isBlocked: boolean) => (
    <View style={styles.card} key={item.id}>
      <AuthImage
        source={{ uri: item.photo }}
        style={[styles.photo, isBlocked && { opacity: 0.55 }]}
      />
      <View style={styles.info}>
        <Text style={styles.name}>
          {item.name}, {item.age}
        </Text>
        <Text style={styles.city}>{item.city}</Text>
        {isBlocked && <Text style={styles.blockedBadge}>Blocked</Text>}
      </View>
      {isBlocked ? (
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item)}
        >
          <Text style={styles.unblockBtnText}>Unblock</Text>
        </TouchableOpacity>
      ) : blockedIds.has(item.id) ? (
        <TouchableOpacity
          style={styles.unblockBtn}
          onPress={() => handleUnblock(item)}
        >
          <Text style={styles.unblockBtnText}>Unblock</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.blockBtn}
          onPress={() => handleBlock(item)}
        >
          <Text style={styles.blockBtnText}>Block</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ScreenContainer edges={['bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Block & Safety</Text>
        <Text style={styles.subtitle}>
          Blocked members cannot view your profile, photos, or message you.
          Unblocking restores all previous messages.
        </Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'blocked' && styles.tabActive]}
          onPress={() => setActiveTab('blocked')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'blocked' && styles.tabTextActive,
            ]}
          >
            Blocked ({blockedList.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'matches' && styles.tabActive]}
          onPress={() => setActiveTab('matches')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'matches' && styles.tabTextActive,
            ]}
          >
            Matches ({allMatchedProfiles.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <BufferingIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : activeTab === 'blocked' ? (
        <FlatList
          data={blockedList}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={1}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
          windowSize={7}
          ListEmptyComponent={
            <EmptyState
              icon="shield-checkmark-outline"
              title="No Blocked Profiles"
              description="You have not blocked any members yet."
            />
          }
          renderItem={({ item }) => renderProfileCard(item, true)}
        />
      ) : (
        <FlatList
          data={allMatchedProfiles}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={1}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          initialNumToRender={8}
          windowSize={7}
          ListEmptyComponent={
            <EmptyState
              icon="chatbubbles-outline"
              title="No Matches Yet"
              description="Once your interests are accepted, you can manage members from here."
            />
          }
          renderItem={({ item }) =>
            renderProfileCard(item, blockedIds.has(item.id))
          }
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: fontSizes.sm,
    color: colors.textLight,
    marginTop: 2,
    fontWeight: '500',
    lineHeight: 18,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: '#F3F4F6',
    borderRadius: radii.lg,
    padding: 4,
  },
  tab: {
    minHeight: 48,
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  tabText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    color: colors.textLight,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  list: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    ...shadow.card,
  },
  photo: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    backgroundColor: colors.primaryLight,
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: fontSizes.sm + 1,
    fontWeight: '800',
    color: colors.text,
  },
  city: {
    fontSize: fontSizes.xs,
    color: colors.textLight,
    marginTop: 2,
  },
  blockedBadge: {
    fontSize: fontSizes.xs,
    color: '#EF4444',
    marginTop: 2,
    fontWeight: '600',
  },
  blockBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  blockBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: '#EF4444',
  },
  unblockBtn: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: colors.background,
  },
  unblockBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    color: colors.text,
  },
});
