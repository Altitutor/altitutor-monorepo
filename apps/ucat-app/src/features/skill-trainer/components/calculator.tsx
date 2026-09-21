import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  applyCalculatorKey,
  createInitialCalculatorState,
  formatCalculatorDisplay,
} from "@/features/skill-trainer/lib/ucat-calculator";
import { haptic } from "@/lib/haptics";

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
};
function keyCaption(key: string) {
  return key === "sqrt" ? "√" : key;
}
function isDigitKey(key: string) {
  return /^[0-9.]$/.test(key);
}

export function CalcKeyChip({ label }: { label: string }) {
  const number = isDigitKey(label);
  return (
    <View
      accessibilityLabel={labels[label] ?? label}
      style={{
        minHeight: 32,
        minWidth: 32,
        paddingHorizontal: 8,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#414042",
        backgroundColor: number ? "#F5F5F5" : "#DE1F2A",
      }}
    >
      <Text
        style={{
          color: number ? "#000000" : "#FFFFFF",
          fontSize: label.length > 2 ? 11 : 13,
          fontWeight: "600",
        }}
      >
        {keyCaption(label)}
      </Text>
    </View>
  );
}

export function CalcKeySequence({ labels }: { labels: string[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        justifyContent: "center",
        minHeight: 32,
      }}
    >
      {labels.map((label, i) => (
        <CalcKeyChip key={`${label}-${i}`} label={label} />
      ))}
    </View>
  );
}

type KeypadProps = {
  onKey: (key: string) => void;
  disabled?: boolean;
};

/** The web TI-108 key layout. */
export function CalculatorKeypad({ onKey, disabled = false }: KeypadProps) {
  const button = (key: string, grow = 1) => {
    const number = isDigitKey(key);
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={labels[key] ?? key}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => {
          haptic(key === "=" ? "heavy" : isDigitKey(key) ? "light" : "medium");
          onKey(key);
        }}
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
          {keyCaption(key)}
        </Text>
      </Pressable>
    );
  };
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
  showDisplay = true,
}: {
  onKey?: (key: string) => void;
  disabled?: boolean;
  showDisplay?: boolean;
} = {}) {
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
      {showDisplay ? (
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
      ) : null}
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
