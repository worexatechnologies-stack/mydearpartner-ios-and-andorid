import { useEffect,useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (active) {
        setReduced(prev => (prev !== value ? value : prev));
      }
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { active = false; subscription.remove(); };
  }, []);
  return reduced;
}
