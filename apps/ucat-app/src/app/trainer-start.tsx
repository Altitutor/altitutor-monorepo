import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { useTrainers, instructions } from "@/features/skill-trainer/catalogue";
import { useOpenScreen } from "@/features/navigation/use-open-screen";
import { api } from "@/lib/api";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";
export default function TrainerStart() {
  const params = useLocalSearchParams<{
    trainerKey?: string;
    taskId?: string;
    blockId?: string;
  }>();
  const query = useTrainers();
  const open = useOpenScreen();
  const block = useQuery({
    queryKey: ["trainer-preview", params.blockId],
    enabled: !!params.blockId,
    queryFn: () =>
      api<{ session: SkillTrainerAttemptState; trainerName: string }>(
        `/learning-modules/blocks/${params.blockId}/skill-trainer-session`,
      ),
  });
  const key =
    block.data?.session.attempt.config_snapshot.trainer_key ??
    params.trainerKey;
  const trainer = query.data?.trainers.find((t) => t.key === key);
  const loading = query.isPending || (!!params.blockId && block.isPending);
  const error = query.error ?? block.error;
  return (
    <Screen>
      <Stack.Screen
        options={{
          title: trainer?.name ?? block.data?.trainerName ?? "Skill trainer",
        }}
      />
      {loading ? (
        <Loading />
      ) : error ? (
        <Failure
          error={error}
          retry={() => {
            void query.refetch();
            if (params.blockId) void block.refetch();
          }}
        />
      ) : !key ? (
        <Copy>That skill trainer is unavailable.</Copy>
      ) : (
        <>
          <Group>
            <Copy large>
              {trainer?.name ?? block.data?.trainerName ?? "Skill trainer"}
            </Copy>
            {trainer?.description && <Copy muted>{trainer.description}</Copy>}
            <Copy>
              {block.data?.session.attempt.config_snapshot.time_limit_seconds ??
                trainer?.time_limit_seconds ??
                60}{" "}
              seconds
            </Copy>
          </Group>
          <Group title="How to play">
            {(instructions[key] ?? []).map((text, i) => (
              <Copy key={text}>
                {i + 1}. {text}
              </Copy>
            ))}
          </Group>
          <Action
            title="Start trainer"
            onPress={() =>
              open({
                pathname: "/trainer-play",
                params: { ...params, trainerKey: key },
              })
            }
          />
        </>
      )}
    </Screen>
  );
}
