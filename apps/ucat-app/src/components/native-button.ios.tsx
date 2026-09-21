import { Host, Button } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled,
  frame,
  labelStyle,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useAppTheme } from "@/features/settings/theme";
import { withHaptic } from "@/lib/haptics";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";

export function NativeButton({
  title,
  onPress,
  disabled: busy = false,
  close = false,
  secondary = false,
  block = false,
  compact = false,
  tint: tintColor,
  accessibilityLabel: label,
}: NativeButtonProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  const color = tintColor ?? c.accent;
  const style = close
    ? "glass"
    : secondary
      ? "glass"
      : block
        ? "glassProminent"
        : "glass";
  return (
    <Host
      matchContents={block ? { vertical: true } : true}
      colorScheme={scheme === "dark" ? "dark" : "light"}
      seedColor={color}
      style={block ? { width: "100%", minHeight: 50 } : undefined}
    >
      <Button
        label={title}
        systemImage={close ? "xmark" : undefined}
        onPress={withHaptic(onPress)}
        modifiers={[
          buttonStyle(style),
          controlSize(block ? "large" : compact ? "small" : "regular"),
          disabled(busy),
          accessibilityLabel(label ?? title),
          tint(color),
          ...(close ? [labelStyle("iconOnly")] : []),
          ...(block
            ? [
                buttonBorderShape("capsule"),
                frame({ maxWidth: Infinity, minHeight: 50 }),
              ]
            : []),
        ]}
      />
    </Host>
  );
}
