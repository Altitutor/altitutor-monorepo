import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

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
  const glass = process.env.EXPO_OS === 'ios' && isLiquidGlassAvailable();
  const selectedIds = Array.isArray(selected) ? selected : [selected];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {choices.map((choice) => {
        const active = selectedIds.includes(choice.id);
        const tint = choice.color ?? theme.primary;
        const label = labelFor ? labelFor(choice) : choice.label;
        return (
          <Pressable
            key={choice.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPressIn={() => haptic()}
            onPress={() => onSelect(choice.id)}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }], borderRadius: 999, overflow: 'hidden' })}>
            <PillFace active={active} glass={glass} tint={tint}>
              <Text style={{ color: active ? '#FFFFFF' : theme.text, fontSize: 14, fontWeight: '600' }}>{label}</Text>
            </PillFace>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function PillFace({ active, glass, tint, children }: { active: boolean; glass: boolean; tint: string; children: ReactNode }) {
  const theme = useTheme();
  const padding = { paddingHorizontal: 14, minHeight: 34, alignItems: 'center' as const, justifyContent: 'center' as const };
  if (active) return <View style={{ ...padding, backgroundColor: tint }}>{children}</View>;
  if (glass) return <GlassView isInteractive style={{ borderRadius: 999 }}><View style={padding}>{children}</View></GlassView>;
  if (process.env.EXPO_OS === 'ios') {
    return <BlurView tint="systemMaterial" intensity={80} style={{ ...padding, overflow: 'hidden', borderRadius: 999 }}>{children}</BlurView>;
  }
  return <View style={{ ...padding, backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border }}>{children}</View>;
}
