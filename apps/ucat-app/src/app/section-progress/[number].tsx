import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import { Copy, Failure, Group, Loading, Meter, Screen } from "@/components/ui";
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
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => {
        void q.refetch();
        void projections.refetch();
      }}
    >
      <Stack.Screen
        options={{ title: q.data?.section.sectionName ?? "Section progress" }}
      />
      {q.isPending ? (
        <Loading />
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
          <Group title="Your questions">
            <Copy large>{q.data.section.maxScore} completed</Copy>
            <Copy muted>
              {Math.round(q.data.section.percentage)}% accuracy ·{" "}
              {q.data.section.correctScore} / {q.data.section.maxScore} points
            </Copy>
          </Group>
          <Group title="Question sets">
            <Copy>
              {q.data.setsCompleted} / {q.data.totalPublicSets} completed
            </Copy>
            <Copy muted>
              {q.data.timedSetsCompleted} timed · {q.data.untimedSetsCompleted}{" "}
              untimed
            </Copy>
          </Group>
          <Group title="By category">
            {q.data.categoryProgress.length ? (
              q.data.categoryProgress.map((category) => (
                <Group key={category.categoryId}>
                  <Copy>{category.categoryName}</Copy>
                  <Copy muted>
                    {Math.round(category.percentage)}% accuracy ·{" "}
                    {category.maxScore} completed
                  </Copy>
                  <Meter value={category.percentage} />
                </Group>
              ))
            ) : (
              <Copy muted>
                Complete some questions to see a category breakdown.
              </Copy>
            )}
          </Group>
        </>
      )}
    </Screen>
  );
}
