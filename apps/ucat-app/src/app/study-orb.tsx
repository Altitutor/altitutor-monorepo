import { useFocusEffect } from "expo-router";
import { Stack } from "expo-router/stack";
import { useCallback, useState } from "react";
import { Pressable, Text } from "react-native";
import {
  Screen,
  Group,
  Copy,
  Action,
  Loading,
  Failure,
  useColors,
} from "@/components/ui";
import { useStudyCompanion } from "@/features/study-plan/components/study-orb";
import { StudyCalendar } from "@/features/study-plan/components/study-calendar";
import { StudyGoal } from "@/features/study-plan/components/study-goal";
import { useLaunchActivity } from "@/features/study-plan/use-launch-activity";
import { openWebSettings } from "@/features/settings/open-web-settings";
import { withHaptic } from "@/lib/haptics";

export default function StudyCompanion() {
  const { query, next } = useStudyCompanion();
  const { launch, busy, error } = useLaunchActivity();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const c = useColors();
  const { refetch } = query;
  const editPlan = () => {
    void openWebSettings("/settings/study-plan").then(() => {
      void refetch();
    });
  };
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
          ...(process.env.EXPO_OS === "ios"
            ? {}
            : {
                headerRight: () => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit study plan"
                    onPress={withHaptic(editPlan)}
                    style={{ padding: 12 }}
                  >
                    <Text style={{ color: c.accent }}>Edit</Text>
                  </Pressable>
                ),
              }),
        }}
      />
      {process.env.EXPO_OS === "ios" ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            accessibilityLabel="Edit study plan"
            onPress={withHaptic(editPlan)}
          >
            Edit
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
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
              <StudyGoal profile={query.data.profile} />
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
                      : "No study activities yet."}
                  </Copy>
                </Group>
              )}
            </>
          )}
        </>
      )}
      {error ? <Failure error={error} /> : null}
    </Screen>
  );
}
