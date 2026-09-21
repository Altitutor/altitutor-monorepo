import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Group, useColors } from "@/components/ui";
import { AppIcon } from "@/components/app-icon";
import { withHaptic } from "@/lib/haptics";

export function ExamCard({
  id,
  kind,
  title,
  attempted,
}: {
  id: string;
  kind: "set" | "mock";
  title: string;
  attempted: boolean;
}) {
  const c = useColors();
  const router = useRouter();
  return (
    <Group compact>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}${attempted ? ", Previously attempted" : ""}`}
        onPress={withHaptic(() =>
          router.push({ pathname: "/exam-start", params: { kind, id } }),
        )}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingVertical: 10,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <AppIcon
          name={kind === "mock" ? "timer" : "stack"}
          color={c.accent}
          size={22}
        />
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text style={{ color: c.text, fontSize: 17, flexShrink: 1 }}>
            {title}
          </Text>
          {attempted && (
            <Text
              style={{
                color: c.accent,
                backgroundColor: c.tint,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              Attempted
            </Text>
          )}
        </View>
        <Text style={{ color: c.secondary, fontSize: 24 }}>›</Text>
      </Pressable>
    </Group>
  );
}
