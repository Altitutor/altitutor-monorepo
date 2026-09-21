import { Stack } from "expo-router/stack";
import { Failure, Loading, Screen } from "@/components/ui";
import { InsightCard } from "@/features/progress/insight-card";
import { buildMockTrajectoryInsight } from "@/features/progress/mock-trajectory-insight";
import { useMockSeries } from "@/features/progress/mock-progress";
import { AttemptList } from "@/features/attempts/attempt-list";
export default function MockProgress() {
  const q = useMockSeries();
  const values =
    q.data?.points
      .filter((p) => p.scaledScoreCount > 0)
      .map((p) => p.scaledScoreSum / p.scaledScoreCount) ?? [];
  const insight = buildMockTrajectoryInsight({
    trend: values.length > 1 ? Math.round(values.at(-1)! - values[0]!) : null,
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: "Mock progress" }} />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <InsightCard insight={insight} label="Mock insight" />
      )}
      <AttemptList source="mock" />
    </Screen>
  );
}
