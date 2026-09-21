import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
export type NavigatorQuestion = {
  index: number;
  stemId: string;
  label: string;
  answered: boolean;
  flagged: boolean;
  current: boolean;
  disabled?: boolean;
  result?: "correct" | "partial" | "incorrect" | "not_attempted";
  timing?: string;
  number?: number;
};
export function QuestionGrid({
  questions,
  onSelect,
}: {
  questions: NavigatorQuestion[];
  onSelect: (index: number) => void;
}) {
  const c = useColors();
  const [width, setWidth] = useState(300);
  const columns = Math.max(2, Math.floor(width / 70));
  const groups = new Map<string, NavigatorQuestion[]>();
  for (const question of questions)
    groups.set(question.stemId, [
      ...(groups.get(question.stemId) ?? []),
      question,
    ]);
  return (
    <>
      {[...groups].map(([stem, items], groupIndex) => (
        <Group key={stem}>
          <Copy muted>Stem {groupIndex + 1}</Copy>
          <View
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={{ flexDirection: "row", flexWrap: "wrap", width: "100%" }}
          >
            {items.map((q) => (
              <View
                key={q.index}
                style={{
                  width: `${100 / Math.min(columns, items.length)}%`,
                  padding: 4,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${q.label}${q.result ? `, ${q.result.replace("_", " ")}` : q.answered ? ", answered" : ", unanswered"}${q.timing ? `, ${q.timing}` : ""}${q.flagged ? ", flagged" : ""}${q.current ? ", current" : ""}${q.disabled ? ", unavailable" : ""}`}
                  disabled={q.disabled}
                  onPress={() => onSelect(q.index)}
                  style={{
                    minHeight: 62,
                    width: "100%",
                    borderRadius: 12,
                    borderWidth: q.current ? 2 : 1,
                    borderColor: q.current ? c.accent : c.border,
                    backgroundColor: q.answered ? c.tint : c.card,
                    opacity: q.disabled ? 0.35 : 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{ color: c.text, fontSize: 18, fontWeight: "600" }}
                  >
                    {q.number ?? q.index + 1}
                  </Text>
                  <Text
                    style={{
                      color:
                        q.result === "correct"
                          ? c.good
                          : q.result === "incorrect"
                            ? c.danger
                            : c.accent,
                    }}
                  >
                    {q.result
                      ? {
                          correct: "✓",
                          incorrect: "✕",
                          partial: "◐",
                          not_attempted: "—",
                        }[q.result]
                      : q.answered
                        ? "✓"
                        : ""}
                    {q.flagged ? " ⚑" : ""}
                  </Text>
                  {q.timing && (
                    <Text
                      style={{
                        color: c.secondary,
                        fontSize: 12,
                        paddingBottom: 6,
                      }}
                    >
                      {q.timing}
                    </Text>
                  )}
                </Pressable>
              </View>
            ))}
          </View>
        </Group>
      ))}
    </>
  );
}
