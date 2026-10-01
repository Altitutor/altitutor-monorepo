import { NativeButton } from "./native-button";
import { useColors } from "./ui";

export function Action({
  title,
  onPress,
  disabled,
  secondary,
  tone,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  tone?: "good" | "danger";
}) {
  const c = useColors();
  return (
    <NativeButton
      title={title}
      onPress={onPress}
      disabled={disabled}
      secondary={secondary}
      block
      tint={tone ? c[tone] : undefined}
    />
  );
}
