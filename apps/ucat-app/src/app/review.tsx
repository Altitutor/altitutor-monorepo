import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ResponseSnapshotV1 } from "@altitutor/ucat-response-contract";
import { Action, Copy, Failure, Group, Loading, Screen } from "@/components/ui";
import { Question } from "@/features/question-engine/components/question";
import {
  mapQuestionStemsToItems,
  type QuestionEngineExam,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import { api } from "@/lib/api";
type Detail = {
  scorePoints?: number;
  totalPoints?: number;
  scaledScore?: number;
  exam?: QuestionEngineExam;
  stemsSnapshot?: QuestionStemWithQuestions[];
  questionAttempts: {
    questionId: string;
    answerSnapshot: ResponseSnapshotV1 | null;
  }[];
};
export default function Review() {
  const { id, kind } = useLocalSearchParams<{ id: string; kind: string }>();
  const [index, setIndex] = useState(0);
  const q = useQuery({
    queryKey: ["review", kind, id],
    queryFn: () =>
      api<Detail>(
        `/progress/${kind === "practice" ? "practice-sessions" : kind === "mock" ? "mock-attempts" : "set-attempts"}/${id}`,
      ),
  });
  const complete = useMutation({
    mutationFn: async () => {
      const path = `/attempt-reviews/${kind === "practice" ? "practice_session" : kind === "mock" ? "mock_attempt" : "set_attempt"}/${id}`;
      const ids = q.data?.questionAttempts.map((a) => a.questionId) ?? [];
      await api(path, { method: "PUT", body: { requiredQuestionIds: ids } });
      for (const questionId of ids)
        await api(path, {
          method: "PATCH",
          body: { action: "view", questionId },
        });
      return api(path, { method: "PATCH", body: { action: "complete" } });
    },
  });
  const questions =
    q.data?.exam?.questions ??
    mapQuestionStemsToItems(q.data?.stemsSnapshot ?? []);
  const question = questions[index];
  return (
    <Screen>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <Failure error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          <Group title="Your result">
            <Copy large>
              {q.data?.scorePoints != null
                ? `${q.data.scorePoints} / ${q.data.totalPoints ?? "—"} points`
                : q.data?.scaledScore != null
                  ? `Score ${q.data.scaledScore}`
                  : "Attempt complete"}
            </Copy>
            <Copy muted>
              Review each response to understand where you can improve.
            </Copy>
          </Group>
          {question && (
            <>
              <Copy>
                Question {index + 1} of {questions.length}
              </Copy>
              <Question
                question={question}
                answer={
                  q.data?.questionAttempts.find(
                    (a) => a.questionId === question.id,
                  )?.answerSnapshot ?? undefined
                }
                onAnswer={() => {}}
                review
              />
              {index > 0 && (
                <Action
                  title="Previous"
                  secondary
                  onPress={() => setIndex(index - 1)}
                />
              )}
              {index + 1 < questions.length ? (
                <Action title="Next" onPress={() => setIndex(index + 1)} />
              ) : (
                <Action
                  title={
                    complete.isSuccess ? "Review completed" : "Complete review"
                  }
                  disabled={complete.isPending || complete.isSuccess}
                  onPress={() => complete.mutate()}
                />
              )}
              {complete.error && <Failure error={complete.error} />}
            </>
          )}
        </>
      )}
    </Screen>
  );
}
