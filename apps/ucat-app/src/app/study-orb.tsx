import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Screen, Group, Copy, Action, Loading, Failure } from "@/components/ui";
import { useStudyCompanion } from "@/features/study-plan/components/study-orb";
import { StudyCalendar } from "@/features/study-plan/components/study-calendar";
import { StudyGoal } from "@/features/study-plan/components/study-goal";
import { useLaunchActivity } from "@/features/study-plan/use-launch-activity";

export default function StudyCompanion() {
  const { query, next } = useStudyCompanion();
  const { launch, busy, error } = useLaunchActivity();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const selectedDate = selected ?? query.data?.today ?? "";
  const tasks =
    query.data?.tasks
      .filter((task) => task.scheduledDate === selectedDate)
      .sort((a, b) => a.sortOrder - b.sortOrder) ?? [];
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: expanded ? "Study plan" : "Your next step",
          sheetAllowedDetents: expanded ? [1] : [0.5, 1],
          sheetInitialDetentIndex: 0,
        }}
      />
      {query.isPending ? (
        <Loading variant="card" />
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Group>
            {next ? (
              <>
                <Copy>{next.title}</Copy>
                <Copy muted>{next.description}</Copy>
                <Action
                  title={busy ? "Opening…" : "Start activity"}
                  disabled={busy}
                  onPress={() =>
                    void launch({
                      ...next,
                      id: "status" in next ? next.id : undefined,
                    })
                  }
                />
              </>
            ) : (
              <Copy muted>
                {query.data?.profile
                  ? "You’re caught up. Come back for your next study day."
                  : "Set up your study plan to get recommendations tailored to your goals."}
              </Copy>
            )}
          </Group>
          {!expanded && (
            <Action
              secondary
              title="View study plan"
              onPress={() => setExpanded(true)}
            />
          )}
          {expanded && query.data && (
            <>
              <StudyCalendar
                today={query.data.today}
                tasks={query.data.tasks}
                selected={selectedDate}
                onSelect={setSelected}
              />
              <Copy large>
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString(
                  undefined,
                  { weekday: "long", day: "numeric", month: "long" },
                )}
              </Copy>
              {tasks.length ? (
                tasks.map((task) => (
                  <Group key={task.id}>
                    <Copy>{task.title}</Copy>
                    <Copy>{task.description}</Copy>
                    <Copy muted>
                      {task.estimatedMinutes} min ·{" "}
                      {task.status.replaceAll("_", " ")}
                    </Copy>
                    <Copy muted>{task.rationale}</Copy>
                    {task.status !== "completed" &&
                      task.status !== "skipped" && (
                        <Action
                          title={
                            task.status === "in_progress" ||
                            task.status === "partial"
                              ? "Continue activity"
                              : "Start activity"
                          }
                          disabled={busy}
                          onPress={() => void launch(task)}
                        />
                      )}
                  </Group>
                ))
              ) : (
                <Group>
                  <Copy muted>
                    {query.data.profile
                      ? "No study activities scheduled for this day."
                      : "Set your goal below to build your study plan."}
                  </Copy>
                </Group>
              )}
              <StudyGoal />
            </>
          )}
        </>
      )}
      {error ? <Failure error={error} /> : null}
    </Screen>
  );
}
