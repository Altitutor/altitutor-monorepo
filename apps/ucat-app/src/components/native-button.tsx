import { Image } from "expo-image";
import { Pressable, Text } from "react-native";
import { withHaptic } from "@/lib/haptics";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";

export function NativeButton({
  title,
  onPress,
  disabled,
  close,
  secondary,
  block,
  compact,
  systemImage,
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
        padding: block ? 14 : compact ? 8 : 12,
        minHeight: block ? 48 : undefined,
        borderRadius: block ? 14 : 24,
        borderCurve: "continuous",
        backgroundColor: secondary ? c.tint : color,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 4,
      }}
    >
      <Text
        style={{
          color: secondary ? color : "#FFFFFF",
          fontWeight: "600",
          fontSize: block ? 16 : compact ? 13 : 14,
        }}
      >
        {close ? "×" : title}
      </Text>
      {systemImage && !close ? (
        <Image
          source={`sf:${systemImage}`}
          style={{ width: 12, height: 12 }}
          tintColor={secondary ? color : "#FFFFFF"}
        />
      ) : null}
    </Pressable>
  );
}
