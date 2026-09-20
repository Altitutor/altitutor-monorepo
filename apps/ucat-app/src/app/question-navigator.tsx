import { useRouter } from "expo-router";
import { Copy, Group, Screen, useColors } from "@/components/ui";
import { Pressable, Text, View } from "react-native";
import { useExamTools } from "@/features/question-engine/components/exam-tools";
export default function Navigator() {
  const tools = useExamTools();
  const router = useRouter();
  const c = useColors();
  const questions = tools.current?.questions ?? [];
  return (
    <Screen>
      <Copy muted>
        ✓ Answered · ⚑ Flagged.
        {questions.some((q) => q.disabled)
          ? " Other mock sections are locked."
          : ""}
      </Copy>
      <Group>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {questions.map((q) => (
            <Pressable
              key={q.index}
              accessibilityRole="button"
              accessibilityLabel={`${q.label}${q.answered ? ", answered" : ", unanswered"}${q.flagged ? ", flagged" : ""}${q.current ? ", current" : ""}${q.disabled ? ", unavailable" : ""}`}
              disabled={q.disabled}
              onPress={() => {
                tools.current?.jump?.(q.index);
                router.back();
              }}
              style={{
                minWidth: 64,
                minHeight: 64,
                padding: 12,
                borderRadius: 12,
                borderWidth: q.current ? 2 : 1,
                borderColor: q.current ? c.accent : c.border,
                backgroundColor: q.answered ? c.tint : c.card,
                opacity: q.disabled ? 0.35 : 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: "600" }}>
                {q.index + 1}
              </Text>
              <Text style={{ color: c.accent }}>
                {q.answered ? "✓" : ""}
                {q.flagged ? " ⚑" : ""}
              </Text>
            </Pressable>
          ))}
        </View>
      </Group>
    </Screen>
  );
}
