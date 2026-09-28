import { Pressable, Text } from "react-native";
import { withHaptic } from "@/lib/haptics";
import { buttonText, useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";

export function NativeButton({
  title,
  onPress,
  disabled,
  close,
  secondary,
  block,
  compact,
  tint: tintColor,
  accessibilityLabel: announced,
}: NativeButtonProps) {
  const c = useColors();
  const color = tintColor ?? c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={announced ?? title}
      onPress={withHaptic(onPress)}
      disabled={disabled}
      style={{
        width: block ? "100%" : undefined,
        alignSelf: block ? "stretch" : undefined,
        padding: block ? 14 : compact ? 8 : 12,
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
          color: secondary ? color : buttonText(color),
          fontWeight: "600",
          fontSize: block ? 16 : compact ? 13 : 14,
        }}
      >
        {close ? "×" : title}
      </Text>
    </Pressable>
  );
}
