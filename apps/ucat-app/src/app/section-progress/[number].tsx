import { AttemptList } from "@/features/attempts/attempt-list";
import { InsightCard } from "@/features/progress/insight-card";
import { SectionStats } from "@/features/progress/section-stats";
import { buildSectionScoreInsight } from "@/features/progress/score-insights";
import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import { Failure, Loading, Screen } from "@/components/ui";
import { progressApi } from "@/features/progress/api";
import { ScoreChart } from "@/features/progress/score-chart";
export default function SectionProgress() {
  const { number } = useLocalSearchParams<{ number: string }>();
  const q = useQuery({
    queryKey: ["section-progress", number],
    queryFn: () => progressApi.section(number),
  });
  const projections = useQuery({
    queryKey: ["score-projection"],
    queryFn: progressApi.projection,
  });
  const projection = projections.data?.sections.find(
    (section) => section.sectionNumber === Number(number),
  );
  const timing = useQuery({
    queryKey: ["section-timing", number],
    queryFn: () => progressApi.timing(number),
  });
  const speed = timing.data?.points.reduce(
    (sum, point) => ({
      total: sum.total + point.examSpeedPercentSum,
      count: sum.count + point.examSpeedCount,
    }),
    { total: 0, count: 0 },
  );
  const weakest = q.data?.categoryProgress
    .filter((c) => c.maxScore > 0)
    .sort((a, b) => a.percentage - b.percentage)[0];
  const score = projection?.currentEstimate;
  const future = projection?.projection.at(-1);
  const insight = buildSectionScoreInsight({
    sectionName: q.data?.section.sectionName ?? "this section",
    score: score ?? null,
    projectedGain:
      score != null && future ? Math.round(future.realistic - score) : null,
    weakestCategory: weakest
      ? { name: weakest.categoryName, accuracy: weakest.percentage }
      : null,
    averageExamSpeed: speed?.count ? speed.total / speed.count : null,
  });
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => {
        void q.refetch();
        void projections.refetch();
        void timing.refetch();
      }}
    >
      <Stack.Screen
        options={{ title: q.data?.section.sectionName ?? "Section progress" }}
      />
      {q.isPending ? (
        <>
          <Loading variant="chart" />
          <Loading variant="card" />
        </>
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {projections.error ? (
            <Failure
              error={projections.error}
              retry={() => void projections.refetch()}
            />
          ) : (
            <ScoreChart
              estimate={projection?.currentEstimate ?? null}
              points={[
                ...(projection?.history
                  .slice(-30)
                  .map((point) => ({ date: point.date, value: point.value })) ??
                  []),
                ...(projection?.projection
                  .filter((point) => [0, 7, 30, 90].includes(point.day))
                  .map((point) => ({
                    date: point.date,
                    value: point.realistic,
                    forecast: point.day > 0,
                  })) ?? []),
              ]}
            />
          )}
          {!projections.isPending && !projections.error && (
            <InsightCard insight={insight} />
          )}
          <SectionStats data={q.data} />
          <AttemptList source="practice" sectionNumber={number} />
          <AttemptList source="set" sectionNumber={number} />
        </>
      )}
    </Screen>
  );
}
