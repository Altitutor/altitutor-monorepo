import { View } from "react-native";
import { Host, Picker, Text, Slider } from "@expo/ui/swift-ui";
import { pickerStyle, tag, tint } from "@expo/ui/swift-ui/modifiers";
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
      <Copy>{label}</Copy>
      <Host
        colorScheme={scheme === "dark" ? "dark" : "light"}
        matchContents={{ vertical: true }}
        style={{ minHeight: 44, flex: 1 }}
      >
        <Picker
          label={label}
          selection={value}
          onSelectionChange={(v) => {
            if (typeof v === "number") onChange(v);
          }}
          modifiers={[pickerStyle("menu"), tint(c.accent)]}
        >
          {options.map((o) => (
            <Text key={o.value} modifiers={[tag(o.value)]}>
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
  );
}
