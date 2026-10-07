import React from 'react';
import { StyleSheet,View,ViewStyle,useWindowDimensions } from 'react-native';
import { Edge,SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  constrained?: boolean;
}

export default function ScreenContainer({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
  constrained = true,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 600;
  const backgroundColor = colors.background;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
      <View
        style={[
          styles.container,
          isLargeScreen && constrained ? styles.constrained : null,
          style,
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  constrained: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
});
