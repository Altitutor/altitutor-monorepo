import { Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";

export function InsightCard({
  insight,
  label = "Score insight",
}: {
  insight: { title: string; body: string };
  label?: string;
}) {
  const c = useColors();
  return (
    <Group>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: c.accent, fontSize: 20 }} accessible={false}>
          ✦
        </Text>
        <Text
          style={{
            color: c.secondary,
            fontSize: 12,
            fontWeight: "600",
            letterSpacing: 1.4,
          }}
        >
          {label.toUpperCase()}
        </Text>
      </View>
      {insight.title.toLowerCase() !== label.toLowerCase() && (
        <Text
          selectable
          style={{
            color: c.text,
            fontSize: 20,
            lineHeight: 27,
            fontWeight: "600",
          }}
        >
          {insight.title}
        </Text>
      )}
      <Copy muted>{insight.body}</Copy>
    </Group>
  );
}
