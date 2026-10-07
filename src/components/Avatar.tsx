import React from 'react';
import { StyleSheet,View } from 'react-native';
import { colors } from '../theme/theme';
import AuthImage from './AuthImage';

interface AvatarProps {
  uri: string;
  size?: number;
}

export default function Avatar({ uri, size = 56 }: AvatarProps) {
  return (
    <View
      style={[
        styles.shadowContainer,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.imageContainer,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <AuthImage
          source={{ uri: uri }}
          style={{ width: size, height: size }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    backgroundColor: 'transparent',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  imageContainer: {
    backgroundColor: colors.primaryLight,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});
