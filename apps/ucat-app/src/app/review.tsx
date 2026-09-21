import { useLocalSearchParams, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { attemptKind, useAttempt } from "@/features/attempts/api";
import { attemptMetrics } from "@/features/attempts/metrics";
import { TimingCard } from "@/features/attempts/timing-card";
import { AttemptQuestions } from "@/features/attempts/question-list";
import { InsightCard } from "@/features/progress/insight-card";
import { buildAttemptOverallInsight } from "@/features/progress/attempt-insights";
export default function AttemptPage() {
  const params = useLocalSearchParams<{ id: string; kind: string }>();
  const kind = attemptKind(params.kind);
  const router = useRouter();
  const q = useAttempt(kind, params.id);
  const data = q.data;
  const metrics = data ? attemptMetrics(data) : null;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <Stack.Screen
        options={{
          title:
            data?.mockName ??
            data?.questionSetName ??
            (data?.sectionName
              ? `${data.sectionName} practice`
              : "Attempt results"),
        }}
      />
      {q.isPending ? (
        <Loading variant="card" count={3} />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : data && metrics ? (
        <>
          <InsightCard
            label="Overall insight"
            insight={buildAttemptOverallInsight({
              accuracyPercent: metrics.accuracy,
              examPacePercent:
                data.studentExamSpeed == null
                  ? null
                  : data.studentExamSpeed * 100,
              averageTimePerQuestionSeconds: metrics.average,
              recentPerformance: data.recentPerformance,
            })}
          />
          <Group title="Score">
            <Copy large>
              {data.scaledScore != null
                ? `${data.scaledScore}${data.scaledScoreMax ? ` / ${data.scaledScoreMax}` : ""}`
                : metrics.score != null
                  ? `${metrics.score} / ${metrics.maximum ?? "—"}`
                  : "Score pending"}
            </Copy>
            <Copy muted>
              {data.scaledScore != null ? "Scaled score · " : ""}
              {metrics.accuracy != null
                ? `${Math.round(metrics.accuracy)}% correct · ${metrics.score} / ${metrics.maximum} points`
                : ""}
            </Copy>
            {data.sets?.map((set, index) => (
              <Copy key={index}>
                {set.questionSetName ?? `Section ${index + 1}`}:{" "}
                {set.scorePoints ?? "—"} / {set.totalPoints ?? "—"}
              </Copy>
            ))}
          </Group>
          <TimingCard data={data} />
          <AttemptQuestions
            questions={data.questionAttempts}
            onSelect={(index) =>
              router.push({
                pathname: "/attempt-question",
                params: { kind, id: params.id, index },
              })
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
