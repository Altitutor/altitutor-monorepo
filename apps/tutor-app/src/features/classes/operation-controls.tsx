import { type PropsWithChildren } from 'react';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function OperationButton({ label, onPress, disabled, prominent = false }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  prominent?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center', justifyContent: 'center', minHeight: 44,
        paddingHorizontal: 14, paddingVertical: 9, borderRadius: 13, borderCurve: 'continuous',
        backgroundColor: prominent ? theme.primary : theme.backgroundSelected,
        opacity: pressed ? 0.72 : disabled ? 0.5 : 1,
      })}>
      <Text style={{ color: prominent ? theme.backgroundElement : theme.primary, fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChoicePills<T extends string | number>({
  label,
  options,
  selected,
  onSelect,
  wrap = true,
  disabled = false,
}: {
  label?: string;
  options: readonly { value: T; label: string; color?: string | null }[];
  selected: readonly T[];
  onSelect: (value: T) => void;
  wrap?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <View accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: wrap ? 'wrap' : 'nowrap', gap: 6 }}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            disabled={disabled}
            accessibilityLabel={label ? `${label}, ${option.label}` : option.label}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => ({
              paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, maxWidth: '100%',
              borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
              borderColor: active ? theme.primary : theme.border,
              opacity: disabled ? 0.65 : 1,
              backgroundColor: active ? theme.primary : pressed ? theme.backgroundSelected : theme.backgroundElement,
            })}>
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
              {option.color ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: option.color }} /> : null}
              <Text style={{ color: active ? theme.backgroundElement : theme.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OperationInput(props: TextInputProps) {
  const theme = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={theme.textSecondary}
      style={{
        color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border,
        borderWidth: 1, borderRadius: 12, borderCurve: 'continuous', fontSize: 16,
        minHeight: props.multiline ? 100 : 44, padding: 12, textAlignVertical: props.multiline ? 'top' : 'center',
      }}
    />
  );
}

export function ControlRow({ children }: PropsWithChildren) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{children}</View>;
}
