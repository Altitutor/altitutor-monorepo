import { Pressable, ScrollView, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

export function FilterPills<T extends string>({
  choices,
  selected,
  onSelect,
  labelFor,
}: {
  choices: { id: T; label: string; color?: string | null }[];
  selected: T | T[];
  onSelect: (id: T) => void;
  labelFor?: (choice: { id: T; label: string }) => string;
}) {
  const theme = useTheme();
  const selectedIds = Array.isArray(selected) ? selected : [selected];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {choices.map((choice) => {
        const active = selectedIds.includes(choice.id);
        const tint = choice.color ?? theme.primary;
        return (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPressIn={() => haptic()}
            onPress={() => onSelect(choice.id)}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.97 : 1 }],
              paddingHorizontal: 14,
              minHeight: 34,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? tint : theme.backgroundElement,
              borderWidth: active ? 0 : 1,
              borderColor: theme.border,
              boxShadow: active ? '0 1px 2px rgba(0, 0, 0, 0.12)' : '0 1px 1px rgba(0, 0, 0, 0.04)',
            })}>
            <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 14, fontWeight: '600' }}>
              {labelFor ? labelFor(choice) : choice.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
