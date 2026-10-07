/**
 * MyDearPartner — Undo Snackbar (U12)
 *
 * A brief bottom snackbar with an Undo button.
 * Disappears automatically after `durationMs` (default 4s).
 *
 * Usage:
 *   const snackbar = useRef<UndoSnackbarRef>(null);
 *   snackbar.current?.show('Interest declined', onUndo);
 */
import React,{ useCallback,useImperativeHandle,useRef,useState } from 'react';
import { Animated,StyleSheet,Text,TouchableOpacity } from 'react-native';
import { colors,fontSizes,radii,spacing } from '../theme/theme';

export interface UndoSnackbarRef {
  show: (message: string, onUndo: () => void, durationMs?: number) => void;
  hide: () => void;
}

const UndoSnackbar = React.forwardRef<UndoSnackbarRef>((_, ref) => {
  const [message, setMessage] = useState('');
  const [onUndoFn, setOnUndoFn] = useState<(() => void) | null>(null);
  const slideAnim = useRef(new Animated.Value(80)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 80,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setMessage('');
      setOnUndoFn(null);
    });
  }, [slideAnim]);

  const show = useCallback((msg: string, onUndo: () => void, durationMs = 4000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(msg);
    setOnUndoFn(() => onUndo);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
    timerRef.current = setTimeout(hide, durationMs);
  }, [slideAnim, hide]);

  useImperativeHandle(ref, () => ({ show, hide }), [show, hide]);

  if (!message) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY: slideAnim }] }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text} numberOfLines={1}>{message}</Text>
      <TouchableOpacity
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          onUndoFn?.();
          hide();
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Undo last action"
      >
        <Text style={styles.undoText}>UNDO</Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

UndoSnackbar.displayName = 'UndoSnackbar';
export default UndoSnackbar;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 110, // above tab bar
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1F2937',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radii.lg,
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  text: {
    color: '#F9FAFB',
    fontSize: fontSizes.sm,
    fontWeight: '600',
    flex: 1,
    marginRight: 16,
  },
  undoText: {
    color: colors.primary,
    fontSize: fontSizes.sm,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
