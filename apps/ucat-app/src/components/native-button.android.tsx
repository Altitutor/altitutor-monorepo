import { Host, FilledTonalButton, Text } from "@expo/ui/jetpack-compose";
import { useAppTheme } from "@/features/settings/theme";
import type { NativeButtonProps } from "./native-button.types";
export function NativeButton({
  title,
  onPress,
  disabled = false,
  close = false,
}: NativeButtonProps) {
  const { scheme } = useAppTheme();
  return (
    <Host matchContents colorScheme={scheme === "dark" ? "dark" : "light"}>
      <FilledTonalButton enabled={!disabled} onClick={onPress}>
        <Text>{close ? "×" : title}</Text>
      </FilledTonalButton>
    </Host>
  );
}
