import { Pressable, Text } from "react-native";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";
export function NativeButton({
  title,
  onPress,
  disabled,
  close,
}: NativeButtonProps) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={{ padding: 12, borderRadius: 24, backgroundColor: c.card }}
    >
      <Text style={{ color: c.accent }}>{close ? "×" : title}</Text>
    </Pressable>
  );
}
