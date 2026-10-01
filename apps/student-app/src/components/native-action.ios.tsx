import { Button, Host } from '@expo/ui/swift-ui';
import { buttonBorderShape, buttonStyle, controlSize, disabled as disabledModifier, foregroundStyle, frame, tint } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

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

export function NativeAction({ label, onPress, disabled, block = false, secondary = false, compact = false, color, labelColor }: NativeActionProps) {
  const { resolvedScheme } = useThemePreference();
  const prominent = !secondary && !compact;
  return (
    <View style={[styles.wrapper, block && styles.block, compact && styles.compact]}>
      <Host
        matchContents={block ? { vertical: true } : true}
        colorScheme={resolvedScheme}
        seedColor={color}
        style={[styles.host, block && styles.block, compact && styles.compact]}>
        <Button
          label={label}
          onPress={withHaptic(onPress)}
          modifiers={[
            buttonStyle(prominent ? 'glassProminent' : 'glass'),
            ...(color ? [tint(color)] : []),
            ...(labelColor ? [foregroundStyle(labelColor)] : []),
            controlSize(compact ? 'small' : block ? 'large' : 'regular'),
            ...(block ? [buttonBorderShape('capsule'), frame({ maxWidth: Infinity, minHeight: 50 })] : []),
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
  block: { width: '100%', minHeight: 50, alignItems: 'stretch', alignSelf: 'stretch' },
  compact: { width: '100%', minHeight: 32, alignItems: 'stretch' },
});
