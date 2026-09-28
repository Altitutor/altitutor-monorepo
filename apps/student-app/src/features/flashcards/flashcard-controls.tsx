import type { PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function FlashcardButton({ children, onPress, disabled, tone = 'default' }: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  tone?: 'default' | 'primary' | 'danger' | 'success' | 'warning';
}>) {
  const theme = useTheme();
  const backgroundColor = tone === 'primary' ? theme.primary
    : tone === 'danger' ? theme.danger
      : tone === 'success' ? theme.success
        : tone === 'warning' ? theme.warning
          : theme.backgroundElement;
  const color = tone === 'default' ? theme.text : theme.backgroundElement;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ backgroundColor, borderColor: theme.border, borderWidth: tone === 'default' ? 1 : 0, borderRadius: 12, borderCurve: 'continuous', minHeight: 48, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>{children}</Text>
    </Pressable>
  );
}
