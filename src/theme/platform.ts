import { Platform } from 'react-native';
import { tokens } from './tokens';

export const platformTheme = {
  shape: {
    buttonRadius: Platform.OS === 'ios' ? tokens.radius.iosButton : tokens.radius.androidButton,
    cardRadius: tokens.radius.card,
  },
  tabBar: {
    height: Platform.OS === 'ios' ? 68 : 88,
  }
};
