import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import FastImage from 'react-native-fast-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Heart, Bell, SlidersHorizontal, Eye, Crown, MapPin, 
  GraduationCap, Search, MessageCircle, User, Zap, MoreHorizontal,
  Plane, Music, Utensils, Film, CheckCircle2
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { getProfiles } from '../api/discover';


export const Discover = () => {
  const insets = useSafeAreaInsets();
  
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: getProfiles,
  });
  
  const currentProfile = profiles.length > 0 ? profiles[0] : null;
  const trendingProfiles = profiles.length > 0 ? profiles : [];

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Background Gradient Blob Simulation */}
      <View style={styles.bgBlobTopRight} />
      <View style={styles.bgBlobCenterLeft} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.logoContainer}>
              <Heart size={26} color="#FF2D78" fill="#FF2D78" />
              <Text style={styles.logoText}>MyDear<Text style={styles.logoTextHighlight}>Partner</Text></Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton}>
                <Bell size={24} color="#10050d" />
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationText}>1</Text>
                </View>
              </TouchableOpacity>
              <FastImage 
                source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100' }} 
                style={styles.avatarMini} 
              />
            </View>
          </View>

          {/* Hero Typography */}
          <View style={styles.heroSection}>
            <Text style={styles.heroSub}>YOUR NEXT CHAPTER</Text>
            <Text style={styles.heroTitle}>
              Discover{'\n'}Someone <Text style={styles.heroTitleItalic}>Special</Text>
            </Text>
            <Text style={styles.heroDesc}>
              Real people. Real connections.{'\n'}Find your forever.
            </Text>
          </View>

          {/* Tabs Row */}
          <View style={styles.tabsRow}>
            <View style={styles.tabsLeft}>
              <TouchableOpacity style={styles.tabActive}>
                <Text style={styles.tabTextActive}>Discover</Text>
                <View style={styles.tabIndicator} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabInactive}>
                <Text style={styles.tabTextInactive}>Likes You</Text>
                <View style={styles.likesBadge}><Text style={styles.likesBadgeText}>5</Text></View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tabInactive}>
                <Text style={styles.tabTextInactive}>Nearby</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.filterButton}>
              <SlidersHorizontal size={20} color="#10050d" />
            </TouchableOpacity>
          </View>

          {/* Stats / Quota Row */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Heart size={18} color="#FF2D78" fill="#FF2D78" />
              <View>
                <Text style={styles.statValue}>999 / 999</Text>
                <Text style={styles.statLabel}>Likes Left</Text>
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Eye size={18} color="#614BCE" />
              <View>
                <Text style={styles.statValue}>49 / 50</Text>
                <Text style={styles.statLabel}>Profile Views</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.vipButton}>
              <Crown size={14} color="#B8860B" fill="#B8860B" />
              <Text style={styles.vipText}>Gold VIP {'>'}</Text>
            </TouchableOpacity>
          </View>

          {/* Main Card */}
          {currentProfile && (
            <View style={styles.mainCardContainer}>
              <FastImage source={{ uri: currentProfile.photoUrl }} style={styles.cardImage} />
              <LinearGradient colors={['rgba(0,0,0,0.1)', 'transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']} style={StyleSheet.absoluteFill} />
              
              {/* Card Top Badges */}
              <View style={styles.cardTopRow}>
                <View style={styles.matchBadge}>
                  <Heart size={12} color="#fff" fill="#fff" />
                  <Text style={styles.matchText}>98% Match</Text>
                </View>
                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>

              {/* Floating Action Buttons */}
              <View style={styles.fabContainer}>
                <TouchableOpacity style={styles.fabSmall}>
                  <MoreHorizontal size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fabLarge}>
                  <Heart size={24} color="#FF2D78" fill="#FF2D78" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.fabLargeWhite}>
                  <MessageCircle size={24} color="#10050d" fill="#10050d" />
                </TouchableOpacity>
              </View>

              {/* Card Info */}
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.nameText}>{currentProfile.name}, {currentProfile.age}</Text>
                  {currentProfile.verified && <CheckCircle2 size={20} color="#1DA1F2" fill="#fff" style={{ marginLeft: 6 }} />}
                </View>
                
                <View style={styles.basicInfoRow}>
                  <MapPin size={12} color="#e0e0e0" /><Text style={styles.basicInfoText}>{currentProfile.city}</Text>
                  <Text style={styles.dotSeparator}>|</Text>
                  <Heart size={12} color="#e0e0e0" /><Text style={styles.basicInfoText}>{currentProfile.religion}</Text>
                  <Text style={styles.dotSeparator}>|</Text>
                  <GraduationCap size={12} color="#e0e0e0" /><Text style={styles.basicInfoText}>{currentProfile.education}</Text>
                </View>

                <Text style={styles.bioText}>“Looking for meaningful conversations and real connections.”</Text>

                <View style={styles.interestRow}>
                  <View style={styles.interestChip}>
                    <Plane size={12} color="#fff" /><Text style={styles.interestText}>Travel</Text>
                  </View>
                  <View style={styles.interestChip}>
                    <Music size={12} color="#fff" /><Text style={styles.interestText}>Music</Text>
                  </View>
                  <View style={styles.interestChip}>
                    <Utensils size={12} color="#fff" /><Text style={styles.interestText}>Food</Text>
                  </View>
                  <View style={styles.interestChip}>
                    <Film size={12} color="#fff" /><Text style={styles.interestText}>Movies</Text>
                  </View>
                  <View style={[styles.interestChip, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={styles.interestText}>+3</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Trending Profiles */}
          <View style={styles.trendingSection}>
            <View style={styles.trendingHeader}>
              <Text style={styles.trendingTitle}>Trending Profiles</Text>
              <Text style={styles.trendingSeeAll}>See All</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingScroll}>
              {trendingProfiles.map((p, index) => (
                <View key={p.id + index.toString()} style={styles.trendingCard}>
                  <FastImage source={{ uri: p.photoUrl }} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.trendingHeartBadge}>
                    <Heart size={14} color="#FF2D78" fill="#FF2D78" />
                  </View>
                  <View style={styles.trendingInfo}>
                    <Text style={styles.trendingName}>{p.name}</Text>
                    <Text style={styles.trendingAge}>{p.age}</Text>
                  </View>
                  <View style={styles.trendingOnlineDot} />
                </View>
              ))}
              {/* Duplicating for list length in mock */}
              {trendingProfiles.map((p, index) => (
                <View key={p.id + index.toString() + 'dup'} style={styles.trendingCard}>
                  <FastImage source={{ uri: p.photoUrl }} style={StyleSheet.absoluteFill} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
                  <View style={styles.trendingHeartBadge}>
                    <Heart size={14} color="#FF2D78" fill="#FF2D78" />
                  </View>
                  <View style={styles.trendingInfo}>
                    <Text style={styles.trendingName}>{p.name}</Text>
                    <Text style={styles.trendingAge}>{p.age}</Text>
                  </View>
                  <View style={styles.trendingOnlineDot} />
                </View>
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Bottom Tab Bar */}
      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.tabItem}>
          <Heart size={24} color="#FF2D78" fill="#FF2D78" />
          <Text style={styles.tabTextActive}>Discover</Text>
        </View>
        <View style={styles.tabItem}>
          <Search size={24} color="#10050d" />
          <Text style={styles.tabText}>Search</Text>
        </View>
        <View style={styles.tabItem}>
          <View>
            <Zap size={24} color="#10050d" />
            <View style={styles.activityBadge}><Text style={styles.activityBadgeText}>3</Text></View>
          </View>
          <Text style={styles.tabText}>Activity</Text>
        </View>
        <View style={styles.tabItem}>
          <MessageCircle size={24} color="#10050d" />
          <Text style={styles.tabText}>Chats</Text>
        </View>
        <View style={styles.tabItem}>
          <User size={24} color="#10050d" />
          <Text style={styles.tabText}>Profile</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5F7',
  },
  bgBlobTopRight: {
    position: 'absolute',
    top: -50,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FFE6F0',
    opacity: 0.8,
  },
  bgBlobCenterLeft: {
    position: 'absolute',
    top: 300,
    left: -100,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#FFF0F5',
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10050d',
    marginLeft: 6,
  },
  logoTextHighlight: {
    color: '#FF2D78',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF2D78',
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  notificationText: {
    color: '#FFF',
    fontSize: 8,
    fontWeight: 'bold',
  },
  avatarMini: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  heroSub: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FF2D78',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 38,
    fontWeight: '800',
    color: '#10050d',
    lineHeight: 42,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  heroTitleItalic: {
    color: '#FF2D78',
    fontStyle: 'italic',
    fontWeight: '700',
  },
  heroDesc: {
    fontSize: 15,
    color: '#666',
    marginTop: 12,
    lineHeight: 22,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tabsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  tabActive: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabTextActive: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF2D78',
  },
  tabIndicator: {
    height: 3,
    width: '100%',
    backgroundColor: '#FF2D78',
    borderRadius: 2,
    position: 'absolute',
    bottom: -4,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tabTextInactive: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8A8A8E',
  },
  likesBadge: {
    backgroundColor: '#FF2D78',
    borderRadius: 10,
    paddingHorizontal: 6,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  likesBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 3,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#10050d',
  },
  statLabel: {
    fontSize: 11,
    color: '#8A8A8E',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#F0EBEF',
    marginHorizontal: 16,
  },
  vipButton: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  vipText: {
    color: '#B8860B',
    fontSize: 12,
    fontWeight: '700',
  },
  mainCardContainer: {
    marginHorizontal: 20,
    height: 480,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#eee',
    marginBottom: 32,
  },
  cardImage: {
    ...StyleSheet.absoluteFill as any,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,45,120,0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  matchText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D18B',
  },
  onlineText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    top: 140,
    alignItems: 'center',
    gap: 16,
  },
  fabSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabLarge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fabLargeWhite: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
  },
  basicInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  basicInfoText: {
    color: '#E0E0E0',
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  dotSeparator: {
    color: '#A0A0A0',
    marginHorizontal: 8,
    fontSize: 12,
  },
  bioText: {
    color: '#FFF',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 16,
    opacity: 0.9,
  },
  interestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  interestText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  trendingSection: {
    marginBottom: 20,
  },
  trendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  trendingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10050d',
  },
  trendingSeeAll: {
    fontSize: 14,
    color: '#8A8A8E',
    fontWeight: '600',
  },
  trendingScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  trendingCard: {
    width: 100,
    height: 130,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#eee',
  },
  trendingHeartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFF',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendingInfo: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  trendingName: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  trendingAge: {
    color: '#E0E0E0',
    fontSize: 11,
  },
  trendingOnlineDot: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D18B',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0EBEF',
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },

  tabText: {
    fontSize: 11,
    color: '#10050d',
    fontWeight: '500',
    marginTop: 2,
  },
  activityBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: '#FF2D78',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFF',
  },
  activityBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

