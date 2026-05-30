import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type NativePagerAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type NativePagerProps = {
  actions: NativePagerAction[];
};

export function NativePager({ actions }: NativePagerProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          disabled={action.disabled}
          onPress={action.onPress}
          style={[styles.button, { backgroundColor: theme.backgroundElement }, action.disabled && styles.disabled]}>
          <Text style={[styles.label, { color: theme.primary }]}>{action.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  button: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '600' },
});
