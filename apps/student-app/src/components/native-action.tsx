import { Button, Host } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

import { withHaptic } from '@/lib/haptics';

type NativeActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  block?: boolean;
  secondary?: boolean;
  compact?: boolean;
};

export function NativeAction({ label, onPress, disabled, block = false, secondary = false, compact = false }: NativeActionProps) {
  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact, secondary && styles.secondary]}>
      <Host style={[styles.host, block && styles.block, compact && styles.compact]}>
        <Button label={label} onPress={withHaptic(onPress)} disabled={disabled} />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, width: '100%' },
  host: { flex: 1, width: '100%' },
  block: { width: '100%', minHeight: 50 },
  compact: { minHeight: 32 },
  secondary: { opacity: 1 },
});
