import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Copy, useColors } from "@/components/ui";
import { createCalculatorEngine } from "@/features/skill-trainer/lib/calculator-engine";
const rows = [
  ["MC", "MR", "M+", "M-", "C"],
  ["7", "8", "9", "÷", "CE"],
  ["4", "5", "6", "×", "√"],
  ["1", "2", "3", "-", "±"],
  ["0", ".", "=", "+"],
];
export function Calculator() {
  const c = useColors();
  const [engine] = useState(createCalculatorEngine);
  const [display, setDisplay] = useState("0");
  return (
    <View style={{ gap: 5 }}>
      <View
        accessibilityLiveRegion="polite"
        style={{
          paddingHorizontal: 8,
          paddingBottom: 6,
          alignItems: "flex-end",
        }}
      >
        <Copy large>{display}</Copy>
      </View>
      {rows.map((row, index) => (
        <View key={index} style={{ flexDirection: "row", gap: 5 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key}
              onPress={() => setDisplay(engine.pressKey(key).display)}
              style={({ pressed }) => ({
                flex: key === "0" ? 2 : 1,
                minHeight: 44,
                backgroundColor: key === "=" ? c.accent : c.tint,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{
                  color: key === "=" ? c.card : c.accent,
                  fontSize: 17,
                  fontWeight: "600",
                }}
              >
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
