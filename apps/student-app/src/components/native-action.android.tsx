import { Button, FilledTonalButton, Host, OutlinedButton, Text } from '@expo/ui/jetpack-compose';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';
import { useThemePreference } from '@/providers/theme-preference-provider';

type NativeActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  block?: boolean;
  secondary?: boolean;
  compact?: boolean;
  color?: string;
  labelColor?: string;
};

function buttonText(background: string) {
  const hex = background.replace('#', '');
  if (hex.length !== 6) return '#FFFFFF';
  const channels = [0, 2, 4].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.55 ? '#171717' : '#FFFFFF';
}

export function NativeAction({ label, onPress, disabled, block = false, secondary = false, compact = false, color, labelColor }: NativeActionProps) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const prominent = !secondary && !compact;
  const Control = prominent ? Button : block ? OutlinedButton : FilledTonalButton;
  const fill = color ?? theme.primary;
  const contentColor = labelColor ?? (prominent ? buttonText(fill) : theme.primary);

  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact]}>
      <Host
        matchContents={block ? { vertical: true } : true}
        colorScheme={resolvedScheme}
        seedColor={fill}
        style={[styles.host, block && styles.block, compact && styles.compact]}
      >
        <Control
          enabled={!disabled}
          onClick={withHaptic(onPress)}
          colors={
            prominent
              ? {
                  containerColor: fill,
                  contentColor,
                  disabledContainerColor: theme.backgroundSelected,
                  disabledContentColor: theme.textSecondary,
                }
              : { contentColor: labelColor ?? theme.primary }
          }
        >
          <Text color={contentColor} style={{ fontWeight: '600' }}>{label}</Text>
        </Control>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
  block: { width: '100%', minHeight: 50, alignItems: 'stretch', alignSelf: 'stretch' },
  compact: { width: '100%', minHeight: 32 },
});
