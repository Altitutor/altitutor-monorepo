import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useColors } from "@/components/ui";
import { haptic } from "@/lib/haptics";

const ROWS = [
  ["7", "8", "9"],
  ["4", "5", "6"],
  ["1", "2", "3"],
  ["+/-", "0", "."],
] as const;

const LABELS: Record<string, string> = {
  "+/-": "Change sign",
  ".": "Decimal point",
  "0": "0",
};

export function NumberPad({
  onKey,
  disabled = false,
}: {
  onKey: (key: string) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <View style={{ gap: 10 }}>
      {ROWS.map((row) => (
        <View key={row.join()} style={{ flexDirection: "row", gap: 10 }}>
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={LABELS[key] ?? key}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => {
                haptic(key === "+/-" ? "medium" : "light");
                onKey(key);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 56,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 28,
                borderCurve: "continuous",
                backgroundColor: c.card,
                opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: c.text,
                  fontSize: key === "+/-" ? 20 : 28,
                  fontWeight: "500",
                  fontVariant: ["tabular-nums"],
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

export function NumberAnswer({
  value,
  disabled,
  onBackspace,
}: {
  value: string;
  disabled: boolean;
  onBackspace: () => void;
}) {
  const c = useColors();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text
        selectable={Boolean(value)}
        accessibilityLabel={`Your answer: ${value || "empty"}`}
        style={{
          flex: 1,
          color: value ? c.text : c.secondary,
          fontSize: 32,
          fontWeight: "600",
          fontVariant: ["tabular-nums"],
          textAlign: "right",
        }}
      >
        {value || "Your answer"}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete digit"
        accessibilityState={{ disabled: disabled || !value }}
        disabled={disabled || !value}
        onPress={() => {
          haptic("medium");
          onBackspace();
        }}
        style={{ padding: 8, opacity: value ? 1 : 0.3 }}
      >
        <Image
          accessibilityIgnoresInvertColors
          source={
            process.env.EXPO_OS === "ios"
              ? "sf:delete.left"
              : {
                  uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c.accent}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5h13v14H8l-6-7Z"/><path d="m14 9-4 6M10 9l4 6"/></svg>`)}`,
                }
          }
          tintColor={c.accent}
          style={{ width: 28, height: 28 }}
        />
      </Pressable>
    </View>
  );
}
