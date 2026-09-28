import { Button, Host } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as disabledModifier, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

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
  const prominent = !secondary && !compact;
  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact, prominent && block && styles.large]}>
      <Host
        matchContents={block ? { vertical: true } : true}
        seedColor={color}
        style={[styles.host, block && styles.block, compact && styles.compact, prominent && block && styles.large]}>
        <Button
          label={label}
          onPress={withHaptic(onPress)}
          modifiers={[
            buttonStyle(prominent ? 'glassProminent' : 'glass'),
            ...(color ? [tint(color)] : []),
            ...(labelColor ? [foregroundStyle(labelColor)] : []),
            ...(compact ? [controlSize('small')] : []),
            ...(block ? [controlSize(prominent ? 'extraLarge' : 'large'), buttonBorderShape('capsule'), frame({ maxWidth: Infinity, minHeight: prominent ? 56 : 50 })] : []),
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
  large: { minHeight: 56 },
  compact: { width: '100%', minHeight: 32, alignItems: 'stretch' },
});
