import * as Haptics from 'expo-haptics';

export function haptic(kind: 'selection' | 'warning' = 'selection') {
  if (process.env.EXPO_OS === 'web') return;
  if (kind === 'warning') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else void Haptics.selectionAsync();
}

export function withHaptic(action: () => void, kind: 'selection' | 'warning' = 'selection') {
  return () => {
    haptic(kind);
    action();
  };
}
