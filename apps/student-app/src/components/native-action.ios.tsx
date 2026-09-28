import { Button, Host } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as disabledModifier, frame } from '@expo/ui/swift-ui/modifiers';
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
  const prominent = !secondary && !compact;
  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact]}>
      <Host matchContents={block ? { vertical: true } : true} style={[styles.host, block && styles.block, compact && styles.compact]}>
        <Button
          label={label}
          onPress={withHaptic(onPress)}
          modifiers={[
            buttonStyle(prominent ? 'glassProminent' : 'glass'),
            ...(compact ? [controlSize('small')] : []),
            ...(block ? [controlSize('large'), buttonBorderShape('capsule'), frame({ maxWidth: Infinity, minHeight: 50 })] : []),
            ...(disabled ? [disabledModifier()] : []),
          ]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
  block: { width: '100%', minHeight: 50 },
  compact: { width: '100%', minHeight: 32, alignItems: 'stretch' },
});
