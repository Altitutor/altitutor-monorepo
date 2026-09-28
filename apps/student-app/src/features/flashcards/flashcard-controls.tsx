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

export function FlashcardRatingButton({ label, preview, tone, onPress, disabled }: {
  label: string;
  preview?: string;
  tone: 'danger' | 'warning' | 'success' | 'primary';
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const backgroundColor = tone === 'danger' ? theme.danger : tone === 'warning' ? theme.warning : tone === 'success' ? theme.success : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={preview ? `${label}, ${preview}` : label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, minHeight: 62, borderRadius: 10, borderCurve: 'continuous', backgroundColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}>
      <Text style={{ color: theme.backgroundElement, fontSize: 14, fontWeight: '700', textAlign: 'center' }}>{label}</Text>
      {preview ? <Text numberOfLines={1} style={{ color: theme.backgroundElement, fontSize: 11, textAlign: 'center' }}>{preview}</Text> : null}
    </Pressable>
  );
}
