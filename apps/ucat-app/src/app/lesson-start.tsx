import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import type { LearningLessonDetail } from "@/features/learning/types";
import { useOpenScreen } from "@/features/navigation/use-open-screen";
import { api } from "@/lib/api";

export default function LessonStart() {
  const { id, taskId } = useLocalSearchParams<{
    id: string;
    taskId?: string;
  }>();
  const openScreen = useOpenScreen();
  const client = useQueryClient();
  const lesson = useQuery({
    queryKey: ["lesson", id],
    queryFn: () => api<LearningLessonDetail>(`/learning-modules/${id}`),
  });
  const start = useMutation({
    mutationFn: async () => {
      // Resuming with a study-plan task must still associate that task with the lesson.
      if (!lesson.data?.module.started_at || taskId) {
        await api(`/learning-modules/${id}/start`, {
          method: "POST",
          body: { studyPlanTaskId: taskId ?? null },
        });
        await client.invalidateQueries({ queryKey: ["lesson", id] });
        void client.invalidateQueries({ queryKey: ["modules"] });
        void client.invalidateQueries({ queryKey: ["plan"] });
      }
    },
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: "Lesson" }} />
      {lesson.isPending ? (
        <Loading />
      ) : lesson.error ? (
        <Failure error={lesson.error} retry={() => void lesson.refetch()} />
      ) : (
        <Group>
          <Copy large>{lesson.data.module.title}</Copy>
          {lesson.data.module.description ? (
            <Copy>{lesson.data.module.description}</Copy>
          ) : null}
          <Copy muted>
            {lesson.data.module.estimated_minutes ?? 0} min ·{" "}
            {lesson.data.blocks.length} parts
          </Copy>
          <Action
            title={
              lesson.data.module.completed_at
                ? "Review lesson"
                : lesson.data.module.started_at
                  ? "Continue lesson"
                  : "Start lesson"
            }
            disabled={start.isPending}
            onPress={() =>
              start.mutate(undefined, {
                onSuccess: () =>
                  openScreen({ pathname: "/lesson/[id]", params: { id } }),
              })
            }
          />
          {start.error ? <Failure error={start.error} /> : null}
        </Group>
      )}
    </Screen>
  );
}
