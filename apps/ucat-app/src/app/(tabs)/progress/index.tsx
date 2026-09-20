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
        <Loading />
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
      {activity.isPending ? (
        <Loading />
      ) : activity.error ? (
        <Failure error={activity.error} retry={() => void activity.refetch()} />
      ) : (
        <ActivityCards activity={activity.data} />
      )}
      {q.isPending ? (
        <Loading />
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
