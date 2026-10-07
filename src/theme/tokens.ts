export const tokens = {
  colors: {
    bgTop: '#5A1536',
    bgMid: '#34102A',
    bgBottom: '#1A0712',
    rose: '#FF2D78',
    roseLight: '#FF5C97',
    blush: '#FBE4EC',
    pinkText: '#F6B9CF',
    gold: '#E9B44C',
    goldLight: '#FFE29A',
    goldInk: '#4A2A00',
    glass: 'rgba(255, 255, 255, 0.08)',
    glassBorder: 'rgba(255, 255, 255, 0.14)',
    cardTop: '#C9577F',
    cardMid: '#7C2A55',
    cardBottom: '#3A1030',
    tabBar: 'rgba(36, 10, 26, 0.92)',
  },
  radius: {
    iosButton: 9999, // full circle
    androidButton: 16, // rounded square (using 16 as an average of 14-18)
    card: 30,
  },
  typography: {
    title: {
      fontFamily: 'Inter-Bold',
      fontSize: 26,
      fontWeight: '700' as const,
    },
    name: {
      fontFamily: 'Inter-Bold',
      fontSize: 32,
      fontWeight: '700' as const,
    },
    chip: {
      fontFamily: 'Inter-Medium',
      fontSize: 13,
      fontWeight: '500' as const,
    },
    tab: {
      fontFamily: 'Inter-SemiBold',
      fontSize: 15,
      fontWeight: '600' as const,
    },
    wordmark: {
      fontFamily: 'PlayfairDisplay-Bold',
      fontSize: 38,
      fontWeight: 'bold' as const,
    },
  },
  spacing: {
    screenPadding: 20,
    gapSmall: 8,
    gapMedium: 12,
    gapLarge: 16,
  },
};
