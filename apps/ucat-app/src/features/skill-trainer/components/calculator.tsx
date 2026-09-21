import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  applyCalculatorKey,
  createInitialCalculatorState,
  formatCalculatorDisplay,
} from "@/features/skill-trainer/lib/ucat-calculator";

const rows = [
  ["+/-", "sqrt", "%", "÷"],
  ["MRC", "M-", "M+", "×"],
  ["7", "8", "9", "-"],
  ["4", "5", "6", "+"],
];
const labels: Record<string, string> = {
  sqrt: "Square root",
  "+/-": "Change sign",
  MRC: "Memory recall or clear",
  "M-": "Subtract from memory",
  "M+": "Add to memory",
  "ON/C": "Clear",
  "÷": "Divide",
  "×": "Multiply",
  "-": "Subtract",
  "+": "Add",
  "=": "Equals",
  Backspace: "Delete digit",
};
type KeypadProps = {
  onKey: (key: string) => void;
  numericOnly?: boolean;
  disabled?: boolean;
};

/** The web TI-108 key layout. Numeric mode emits raw answer-entry keys without performing arithmetic. */
export function CalculatorKeypad({
  onKey,
  numericOnly = false,
  disabled = false,
}: KeypadProps) {
  const button = (key: string, grow = 1) => {
    const number = /^[0-9.]$/.test(key);
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={
          numericOnly && key === "=" ? "Submit answer" : (labels[key] ?? key)
        }
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onKey(key)}
        style={({ pressed }) => ({
          flex: grow,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: number ? "#F5F5F5" : "#DE1F2A",
          borderWidth: 1,
          borderColor: "#414042",
          borderRadius: 5,
          opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
        })}
      >
        <Text
          style={{
            color: number ? "#000000" : "#FFFFFF",
            fontSize: key.length > 2 ? 15 : 20,
            fontWeight: "600",
          }}
        >
          {key === "sqrt" ? "√" : key === "Backspace" ? "⌫" : key}
        </Text>
      </Pressable>
    );
  };
  if (numericOnly)
    return (
      <View style={{ gap: 5 }}>
        {[
          ["7", "8", "9", "Backspace"],
          ["4", "5", "6", "."],
        ].map((row, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 5 }}>
            {row.map((key) => button(key))}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 5 }}>
          <View style={{ flexGrow: 3, flexBasis: 10, gap: 5 }}>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {["1", "2", "3"].map((key) => button(key))}
            </View>
            <View style={{ flexDirection: "row", gap: 5 }}>
              {button("+/-")}
              {button("0", 2)}
            </View>
          </View>
          {button("=")}
        </View>
      </View>
    );
  return (
    <View style={{ gap: 5 }}>
      {rows.map((row, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 5 }}>
          {row.map((key) => button(key))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 5 }}>
        <View style={{ flexGrow: 3, flexBasis: 10, gap: 5 }}>
          {[
            ["1", "2", "3"],
            ["ON/C", "0", "."],
          ].map((row, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 5 }}>
              {row.map((key) => button(key))}
            </View>
          ))}
        </View>
        {button("=")}
      </View>
    </View>
  );
}

export function Calculator({
  onKey,
  disabled = false,
}: { onKey?: (key: string) => void; disabled?: boolean } = {}) {
  const [state, setState] = useState(createInitialCalculatorState);
  const display = formatCalculatorDisplay(state);
  return (
    <View
      style={{
        width: "100%",
        maxWidth: 420,
        alignSelf: "center",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#414042",
        backgroundColor: "#507ABD",
        padding: 12,
        gap: 8,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          backgroundColor: "#C5CEBD",
          borderRadius: 3,
          padding: 8,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Text
          accessibilityLabel={
            state.memoryValue !== 0 ? "Memory stored" : "Memory empty"
          }
          style={{ color: "#151915", fontSize: 12 }}
        >
          {state.memoryValue !== 0 ? "M" : ""}
        </Text>
        <Text
          selectable
          accessibilityLabel={`Calculator display ${display}`}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            flex: 1,
            textAlign: "right",
            color: "#101510",
            fontSize: 29,
            fontVariant: ["tabular-nums"],
          }}
        >
          {display}
        </Text>
      </View>
      <Text
        style={{
          textAlign: "center",
          fontSize: 11,
          color: "#FFFFFF",
          fontWeight: "600",
        }}
      >
        TI-108 · UCAT calculator
      </Text>
      <CalculatorKeypad
        disabled={disabled}
        onKey={(key) => {
          setState((current) => applyCalculatorKey(current, key));
          onKey?.(key);
        }}
      />
    </View>
  );
}
