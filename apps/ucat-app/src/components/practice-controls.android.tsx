import {
  Host,
  DropdownMenu,
  DropdownMenuItem,
  Text,
  Slider,
} from "@expo/ui/jetpack-compose";
import { useAppTheme } from "@/features/settings/theme";
import { useColors } from "./ui";
import type { ChoiceProps, PaceProps } from "./practice-controls.types";
export function Choice({ label, value, onChange, options }: ChoiceProps) {
  const { scheme } = useAppTheme();
  return (
    <Host
      colorScheme={scheme === "dark" ? "dark" : "light"}
      matchContents={{ vertical: true }}
      style={{ width: "100%", minHeight: 48 }}
    >
      <DropdownMenu>
        <DropdownMenu.Trigger>
          <Text>
            {label}: {options.find((o) => o.value === value)?.label} ▾
          </Text>
        </DropdownMenu.Trigger>
        <DropdownMenu.Items>
          {options.map((o) => (
            <DropdownMenuItem key={o.value} onClick={() => onChange(o.value)}>
              <DropdownMenuItem.Text>
                <Text>{o.label}</Text>
              </DropdownMenuItem.Text>
            </DropdownMenuItem>
          ))}
        </DropdownMenu.Items>
      </DropdownMenu>
    </Host>
  );
}
export function PaceSlider({ value, onChange }: PaceProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  return (
    <Host
      colorScheme={scheme === "dark" ? "dark" : "light"}
      matchContents={{ vertical: true }}
      style={{ width: "100%", minHeight: 48 }}
    >
      <Slider
        value={value}
        min={0.25}
        max={2}
        steps={6}
        onValueChange={onChange}
        colors={{ thumbColor: c.accent, activeTrackColor: c.accent }}
      />
    </Host>
  );
}
