import {
  Host,
  Button,
  FilledTonalButton,
  OutlinedButton,
  Text,
} from "@expo/ui/jetpack-compose";
import { useAppTheme } from "@/features/settings/theme";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";

export function NativeButton({
  title,
  onPress,
  disabled = false,
  close = false,
  secondary = false,
  block = false,
  tint: tintColor,
}: NativeButtonProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  const color = tintColor ?? c.accent;
  const label = close ? "×" : title;
  const prominent = block && !close && !secondary;
  const Control = prominent
    ? Button
    : block && !close
      ? OutlinedButton
      : FilledTonalButton;
  return (
    <Host
      matchContents={block ? { vertical: true } : true}
      colorScheme={scheme === "dark" ? "dark" : "light"}
      seedColor={color}
      style={block ? { width: "100%", minHeight: 48 } : undefined}
    >
      <Control
        enabled={!disabled}
        onClick={onPress}
        colors={
          prominent
            ? { containerColor: color }
            : { contentColor: color }
        }
      >
        <Text>{label}</Text>
      </Control>
    </Host>
  );
}
