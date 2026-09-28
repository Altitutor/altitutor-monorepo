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
};

export function NativeAction({ label, onPress, disabled, block = false, secondary = false, compact = false }: NativeActionProps) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const prominent = !secondary && !compact;
  const Control = prominent ? Button : block ? OutlinedButton : FilledTonalButton;
  const contentColor = prominent ? theme.backgroundElement : theme.primary;

  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact]}>
      <Host
        matchContents={block ? { vertical: true } : true}
        colorScheme={resolvedScheme}
        seedColor={theme.primary}
        style={[styles.host, block && styles.block, compact && styles.compact]}
      >
        <Control
          enabled={!disabled}
          onClick={withHaptic(onPress)}
          colors={
            prominent
              ? {
                  containerColor: theme.primary,
                  contentColor: theme.backgroundElement,
                  disabledContainerColor: theme.backgroundSelected,
                  disabledContentColor: theme.textSecondary,
                }
              : { contentColor: theme.primary }
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
  block: { width: '100%', minHeight: 50 },
  compact: { width: '100%', minHeight: 32 },
});
