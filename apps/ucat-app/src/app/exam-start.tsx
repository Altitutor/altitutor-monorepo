import { useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router/stack";
import { useQuery } from "@tanstack/react-query";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { loadExam } from "@/features/question-engine/api/native-exam-api";
import { segmentsFor } from "@/features/question-engine/model/native-engine";
import { useOpenScreen } from "@/features/navigation/use-open-screen";
export default function ExamStart() {
  const params = useLocalSearchParams<{
    id: string;
    kind: string;
    resume?: string;
    taskId?: string;
  }>();
  const kind =
    params.kind === "set" || params.kind === "mock" ? params.kind : "practice";
  const openScreen = useOpenScreen();
  const query = useQuery({
    queryKey: ["exam-entry", kind, params.id],
    queryFn: () => loadExam(kind, params.id),
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: query.data?.title ?? "Your attempt" }} />
      {query.isPending ? (
        <Loading variant="detail" />
      ) : query.error ? (
        <Failure error={query.error} retry={() => void query.refetch()} />
      ) : query.data ? (
        <>
          <Group>
            <Copy large>{query.data.title}</Copy>
            <Copy>{query.data.questions.length} questions</Copy>
            <Copy muted>
              {segmentsFor(query.data).some((s) => s.seconds)
                ? "The timer continues if you leave the app. Your answers are saved as you progress."
                : "Take your time. You can save and return to your attempt."}
            </Copy>
          </Group>
          <Action
            title={params.resume === "true" ? "Resume attempt" : "Begin"}
            onPress={() =>
              openScreen({
                pathname: "/exam",
                params: { ...params, kind, autoStart: "true" },
              })
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
