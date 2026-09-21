import { ScrollView, Text, View } from "react-native";
import { Copy, Group, useColors } from "@/components/ui";
import type { AttemptDetail } from "./api";
import { attemptMetrics, formatDuration } from "./metrics";
export function TimingCard({ data }: { data: AttemptDetail }) {
  const c = useColors();
  const m = attemptMetrics(data);
  const max = Math.max(
    1,
    ...data.questionAttempts.map((q) => q.timeSpentSeconds ?? 0),
  );
  const color = (result: string) =>
    result === "correct"
      ? c.good
      : result === "partial"
        ? c.accent
        : result === "incorrect"
          ? c.danger
          : c.secondary;
  return (
    <Group title="Timing">
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Copy muted>Total time</Copy>
          <Copy large>{formatDuration(m.duration)}</Copy>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Copy muted>Per question</Copy>
          <Copy large>{formatDuration(m.average)}</Copy>
        </View>
      </View>
      {data.studentExamSpeed != null && (
        <Copy muted>
          {Math.round(data.studentExamSpeed * 100) / 100}× exam pace
        </Copy>
      )}
      {data.questionAttempts.some((q) => q.timeSpentSeconds != null) ? (
        <>
          <View style={{ flexDirection: "row" }}>
            <View
              style={{
                width: 44,
                height: 160,
                justifyContent: "space-between",
                paddingBottom: 25,
              }}
            >
              <Text style={{ color: c.secondary, fontSize: 11 }}>
                {formatDuration(max)}
              </Text>
              <Text style={{ color: c.secondary, fontSize: 11 }}>0s</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={{ gap: 6, paddingHorizontal: 4 }}
            >
              {data.questionAttempts.map((q) => (
                <View
                  key={q.questionId}
                  accessible
                  accessibilityLabel={`Question ${q.questionNumber}, ${q.result.replaceAll("_", " ")}, ${formatDuration(q.timeSpentSeconds)}`}
                  style={{
                    width: 28,
                    height: 160,
                    justifyContent: "flex-end",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      height:
                        q.timeSpentSeconds == null
                          ? 0
                          : Math.max(2, (q.timeSpentSeconds / max) * 130),
                      width: 18,
                      borderRadius: 4,
                      backgroundColor: color(q.result),
                    }}
                  />
                  <Text
                    style={{ color: c.secondary, fontSize: 11, height: 18 }}
                  >
                    {q.questionNumber}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
          <Copy muted>
            Time per question · green correct · red incorrect · blue partial ·
            grey unanswered
          </Copy>
        </>
      ) : (
        <Copy muted>No question timing was recorded for this attempt.</Copy>
      )}
    </Group>
  );
}
