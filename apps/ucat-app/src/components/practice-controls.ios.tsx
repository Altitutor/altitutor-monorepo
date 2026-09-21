import { PaceTicks } from "./pace-ticks";
import { View } from "react-native";
import { Host, Picker, Text, Slider } from "@expo/ui/swift-ui";
import {
  pickerStyle,
  foregroundStyle,
  labelsHidden,
  tag,
  tint,
  frame,
  fixedSize,
  multilineTextAlignment,
} from "@expo/ui/swift-ui/modifiers";
import { useAppTheme } from "@/features/settings/theme";
import { Copy, useColors } from "./ui";
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
        style={{ minHeight: 44, flex: 1, minWidth: 0 }}
      >
        <Picker
          label={label}
          selection={value}
          onSelectionChange={(v) => {
            if (typeof v === "number") onChange(v);
          }}
          modifiers={[
            pickerStyle("menu"),
            labelsHidden(),
            foregroundStyle(c.accent),
            tint(c.accent),
            frame({ maxWidth: Infinity, alignment: "trailing" }),
          ]}
        >
          {options.map((o) => (
            <Text
              key={o.value}
              modifiers={[
                tag(o.value),
                fixedSize({ horizontal: false, vertical: true }),
                multilineTextAlignment("trailing"),
              ]}
            >
              {o.label}
            </Text>
          ))}
        </Picker>
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
        style={{ minHeight: 44, width: "100%" }}
      >
        <Slider
          value={value}
          min={0.25}
          max={2}
          step={0.25}
          onValueChange={onChange}
          modifiers={[tint(c.accent)]}
        />
      </Host>
      <PaceTicks />
    </View>
  );
}
