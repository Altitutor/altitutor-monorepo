import { View } from "react-native";
import { PaceTicks } from "./pace-ticks";
import {
  Host,
  DropdownMenu,
  DropdownMenuItem,
  Text,
  Slider,
} from "@expo/ui/jetpack-compose";
import { useAppTheme } from "@/features/settings/theme";
import { Copy, useColors } from "./ui";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import type { ChoiceProps, PaceProps } from "./practice-controls.types";
export function Choice({ label, value, onChange, options }: ChoiceProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        minHeight: 48,
      }}
    >
      <View style={{ flexShrink: 0, maxWidth: "42%" }}>
        <Copy>{label}</Copy>
      </View>
      <Host
        colorScheme={scheme === "dark" ? "dark" : "light"}
        matchContents={{ vertical: true }}
        style={{ flex: 1, minWidth: 0, minHeight: 44 }}
      >
        <DropdownMenu>
          <DropdownMenu.Trigger>
            <Text
              color={c.accent}
              style={{ textAlign: "end" }}
              modifiers={[fillMaxWidth()]}
            >
              {options.find((o) => o.value === value)?.label} ▾
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
    </View>
  );
}
export function PaceSlider({ value, onChange }: PaceProps) {
  const { scheme } = useAppTheme();
  const c = useColors();
  return (
    <View>
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
      <PaceTicks />
    </View>
  );
}
