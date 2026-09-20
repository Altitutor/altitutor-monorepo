import { Host, Button } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  controlSize,
  disabled,
  labelStyle,
  accessibilityLabel,
  tint,
} from "@expo/ui/swift-ui/modifiers";
import { useAppTheme } from "@/features/settings/theme";
import { useColors } from "./ui";
import type { NativeButtonProps } from "./native-button.types";
export function NativeButton({
  title,
  onPress,
  disabled: busy = false,
  close = false,
}: NativeButtonProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  return (
    <Host matchContents colorScheme={scheme === "dark" ? "dark" : "light"}>
      <Button
        label={title}
        systemImage={close ? "xmark" : undefined}
        onPress={onPress}
        modifiers={[
          buttonStyle("glass"),
          controlSize("regular"),
          disabled(busy),
          accessibilityLabel(title),
          tint(c.accent),
          ...(close ? [labelStyle("iconOnly")] : []),
        ]}
      />
    </Host>
  );
}
