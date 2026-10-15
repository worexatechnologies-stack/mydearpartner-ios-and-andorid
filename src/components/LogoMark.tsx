import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

interface LogoMarkProps {
  size?: number;
  rotation1?: number; // Kept for backward compatibility if used anywhere
  rotation2?: number; // Kept for backward compatibility if used anywhere
}

export const LogoMark = ({ size = 150 }: LogoMarkProps) => {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Image
        source={require('../assets/images/logo.png')}
        style={{
          width: '100%',
          height: '100%',
          resizeMode: 'contain',
        }}
      />
    </View>
  );
};
