import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Path, Circle } from 'react-native-svg';

interface LogoMarkProps {
  size?: number;
  rotation1?: number;
  rotation2?: number;
}

export const LogoMark = ({ size = 150, rotation1 = 0, rotation2 = 0 }: LogoMarkProps) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="roseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF5C97" />
          <Stop offset="100%" stopColor="#FF2D78" />
        </LinearGradient>
        <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FFE29A" />
          <Stop offset="100%" stopColor="#E9B44C" />
        </LinearGradient>
      </Defs>

      {/* Left Ring */}
      <Circle
        cx="45"
        cy="60"
        r="30"
        fill="none"
        stroke="url(#roseGradient)"
        strokeWidth="7"
        transform={`rotate(${rotation1}, 45, 60)`}
      />

      {/* Right Ring */}
      <Circle
        cx="75"
        cy="60"
        r="30"
        fill="none"
        stroke="url(#goldGradient)"
        strokeWidth="7"
        transform={`rotate(${rotation2}, 75, 60)`}
      />

      {/* Heart overlapping intersection */}
      <Path
        d="M60 70.5 C 57 67, 53 62, 53 58 C 53 54.5, 55.5 52, 59 52 C 59.5 52, 60 52.2, 60 52.2 C 60 52.2, 60.5 52, 61 52 C 64.5 52, 67 54.5, 67 58 C 67 62, 63 67, 60 70.5 Z"
        fill="#FFFFFF"
      />
    </Svg>
  );
};
