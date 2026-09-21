import { Pressable, Text } from "react-native";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";

export function NativeButton({
  title,
  onPress,
  disabled,
  close,
  secondary,
  block,
  tint: tintColor,
}: NativeButtonProps) {
  const c = useColors();
  const color = tintColor ?? c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      disabled={disabled}
      style={{
        padding: block ? 14 : 12,
        minHeight: block ? 48 : undefined,
        borderRadius: block ? 14 : 24,
        borderCurve: "continuous",
        backgroundColor: secondary ? c.tint : color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: secondary
            ? color
            : c.background === "#171717"
              ? "#171717"
              : "#FFFFFF",
          fontWeight: "600",
          fontSize: block ? 16 : 14,
        }}
      >
        {close ? "×" : title}
      </Text>
    </Pressable>
  );
}
