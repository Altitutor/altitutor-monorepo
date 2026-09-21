import { InsightCard } from "@/features/progress/insight-card";
import { buildTotalScoreInsight } from "@/features/progress/score-insights";
import { ScoreBySection } from "@/features/progress/score-by-section";
import { HeaderActions } from "@/components/header-actions";
import { progressApi } from "@/features/progress/api";
import { ScoreChart } from "@/features/progress/score-chart";
import { ActivityCards } from "@/features/progress/activity-cards";
import { deriveTotalScoreProjection } from "@/features/progress/total-projection";
import { useQuery } from "@tanstack/react-query";
import { Failure, Loading, Screen } from "@/components/ui";
import { dataApi } from "@/features/dashboard/api";
export default function Progress() {
  const projections = useQuery({
    queryKey: ["score-projection"],
    queryFn: progressApi.projection,
  });
  const activity = useQuery({
    queryKey: ["activity"],
    queryFn: progressApi.activity,
  });
  const plan = useQuery({ queryKey: ["plan"], queryFn: dataApi.plan });
  const total = deriveTotalScoreProjection(projections.data?.sections ?? []);
  const q = useQuery({ queryKey: ["progress"], queryFn: dataApi.progress });
  const baseline =
    projections.data?.snapshots.length && projections.data.snapshots.length > 1
      ? projections.data.snapshots[0]
      : null;
  const future = total.projection.find((point) => point.day === 90);
  const insight = buildTotalScoreInsight({
    currentEstimate: total.currentEstimate,
    improvement:
      total.currentEstimate != null && baseline
        ? Math.round(total.currentEstimate - baseline.currentEstimate)
        : null,
    projectedGain:
      total.currentEstimate != null && future
        ? Math.round(future.realistic - total.currentEstimate)
        : null,
    benchmarkPercentileLabel: null,
  });
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => {
        void q.refetch();
        void projections.refetch();
        void activity.refetch();
      }}
    >
      <HeaderActions />
      {projections.isPending ? (
        <Loading variant="chart" />
      ) : projections.error ? (
        <Failure
          error={projections.error}
          retry={() => void projections.refetch()}
        />
      ) : (
        <ScoreChart
          estimate={total.currentEstimate}
          target={plan.data?.profile?.targetScore}
          points={[
            ...(projections.data?.snapshots.slice(-30).map((point) => ({
              date: point.date,
              value: point.currentEstimate,
            })) ?? []),
            ...total.projection
              .filter((point) => [0, 7, 30, 90].includes(point.day))
              .map((point) => ({
                date: point.date,
                value: point.realistic,
                forecast: point.day > 0,
              })),
          ]}
        />
      )}
      {!projections.isPending && !projections.error && (
        <InsightCard insight={insight} />
      )}
      {activity.isPending ? (
        <Loading variant="card" />
      ) : activity.error ? (
        <Failure error={activity.error} retry={() => void activity.refetch()} />
      ) : (
        <ActivityCards activity={activity.data} />
      )}
      {q.isPending ? (
        <Loading variant="card" />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <ScoreBySection
            sections={q.data.sectionProgress}
            projections={projections.data?.sections ?? []}
            targets={plan.data?.generation?.sectionTargets}
          />
        </>
      )}
    </Screen>
  );
}
