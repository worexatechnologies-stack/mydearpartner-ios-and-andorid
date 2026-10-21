import React from 'react';
import { Image, StyleProp, View, ViewStyle } from 'react-native';

interface LogoMarkProps {
  size?: number;
  rotation1?: number; // Kept for backward compatibility if used anywhere
  rotation2?: number; // Kept for backward compatibility if used anywhere
  style?: StyleProp<ViewStyle>;
}

export const LogoMark = React.memo(({ size = 150, style }: LogoMarkProps) => {
  return (
    <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
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
});

