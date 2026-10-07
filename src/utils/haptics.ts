import { Platform,Vibration } from 'react-native';

export const triggerHaptic = (
  type:
    | 'light'
    | 'medium'
    | 'heavy'
    | 'success'
    | 'warning'
    | 'error' = 'light',
) => {
  // Simple fallback for both iOS and Android using standard Vibration API
  // react-native Vibration on iOS translates to short vibrations if duration is very small
  let pattern = [0, 20]; // Default light vibration
  switch (type) {
    case 'light':
      pattern = [0, 20];
      break;
    case 'medium':
      pattern = [0, 40];
      break;
    case 'heavy':
      pattern = [0, 60];
      break;
    case 'success':
      pattern = [0, 20, 50, 40];
      break;
    case 'warning':
      pattern = [0, 40, 50, 40];
      break;
    case 'error':
      pattern = [0, 60, 50, 60, 50, 60];
      break;
  }

  if (Platform.OS === 'ios') {
    // iOS Vibration API doesn't support patterns well natively without haptic feedback library
    // We just do a short burst
    Vibration.vibrate();
  } else {
    Vibration.vibrate(pattern, false);
  }
};
