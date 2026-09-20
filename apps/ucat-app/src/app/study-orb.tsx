import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import {
  Screen,
  Group,
  Copy,
  Action,
  Loading,
  Failure,
  Meter,
} from "@/components/ui";
import { useStudyCompanion } from "@/features/study-plan/components/study-orb";
import { useLaunchActivity } from "@/features/study-plan/use-launch-activity";
export default function StudyCompanion() {
  const { query, next, progress } = useStudyCompanion();
  const { launch, busy, error } = useLaunchActivity();
  const router = useRouter();
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  return (
    <Screen>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <Group>
            <Copy large>
              {progress.total && progress.completed === progress.total
                ? "Today’s plan complete"
                : "Your next step"}
            </Copy>
            {progress.total > 0 && (
              <>
                <Meter value={progress.percent} />
                <Copy muted>
                  {progress.completed} of {progress.total} activities complete
                </Copy>
              </>
            )}
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
                  ? "You’re caught up. Choose some extra practice or come back for your next study day."
                  : "Set up your study plan to get recommendations tailored to your goals."}
              </Copy>
            )}
          </Group>
          <Action
            secondary
            title="View study plan"
            onPress={() => router.replace("/study-plan")}
          />
          {!next && (
            <Action
              secondary
              title="Choose practice"
              onPress={() => router.dismissTo("/practice")}
            />
          )}
        </>
      )}
      {error ? <Failure error={error} /> : null}
    </Screen>
  );
}
