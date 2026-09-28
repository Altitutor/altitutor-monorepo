import { Button, Host } from '@expo/ui';
import { StyleSheet, Text, View } from 'react-native';

import { withHaptic } from '@/lib/haptics';

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

export function NativeAction({ label, onPress, disabled, block = false, secondary = false, compact = false, color, labelColor }: NativeActionProps) {
  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact, secondary && styles.secondary]}>
      <Host style={[styles.host, block && styles.block, compact && styles.compact]}>
        <Button
          label={labelColor ? undefined : label}
          onPress={withHaptic(onPress)}
          disabled={disabled}
          style={{
            backgroundColor: color,
            width: block ? '100%' : undefined,
            height: block ? 56 : undefined,
          }}>
          {labelColor ? <Text style={{ color: labelColor, fontWeight: '600', fontSize: 17 }}>{label}</Text> : null}
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, width: '100%' },
  host: { flex: 1, width: '100%' },
  block: { width: '100%', minHeight: 50, alignSelf: 'stretch' },
  compact: { minHeight: 32 },
  secondary: { opacity: 1 },
});
