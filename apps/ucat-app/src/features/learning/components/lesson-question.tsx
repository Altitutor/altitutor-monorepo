import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { ResponseSnapshotV1 } from "@altitutor/ucat-response-contract";
import { Action, Failure, Loading } from "@/components/ui";
import { Question } from "@/features/question-engine/components/question";
import {
  mapQuestionStemsToItems,
  mapQuestionsToItems,
  type QuestionEngineQuestion,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import type { LearningModuleBlockRow } from "@/features/learning/types";
import { api } from "@/lib/api";
export function LessonQuestion({
  block,
  onCompleted,
}: {
  block: LearningModuleBlockRow;
  onCompleted: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, ResponseSnapshotV1>>(
    {},
  );
  const [review, setReview] = useState(false);
  const q = useQuery({
    queryKey: ["lesson-question", block.id],
    queryFn: async () =>
      block.block_type === "question"
        ? mapQuestionsToItems([
            await api<QuestionEngineQuestion>(
              `/learn/questions/${block.question_id}?blockId=${block.id}`,
            ),
          ])
        : mapQuestionStemsToItems(
            (
              await api<{ stems: QuestionStemWithQuestions[] }>(
                "/practice-stems/by-ids",
                { method: "POST", body: { stemIds: [block.question_stem_id] } },
              )
            ).stems,
          ),
  });
  const submit = useMutation({
    mutationFn: () =>
      api("/question-attempts/batch", {
        method: "POST",
        body: {
          studentQuestionSetAttemptId: null,
          learningModuleBlockId: block.id,
          attempts: (q.data ?? []).map((question) => ({
            questionId: question.id,
            answerSnapshot: answers[question.id] ?? null,
            mode: "learn",
            wasTimed: false,
          })),
        },
      }),
    onSuccess: () => {
      setReview(true);
      onCompleted();
    },
  });
  const question = q.data?.[index];
  return q.isPending ? (
    <Loading />
  ) : q.error ? (
    <Failure error={q.error} retry={() => void q.refetch()} />
  ) : question ? (
    <>
      <Question
        question={question}
        answer={answers[question.id]}
        review={review}
        onAnswer={(a) => setAnswers({ ...answers, [question.id]: a })}
      />
      {index > 0 && (
        <Action
          secondary
          title="Previous question"
          onPress={() => setIndex(index - 1)}
        />
      )}
      {index + 1 < (q.data?.length ?? 0) ? (
        <Action title="Next question" onPress={() => setIndex(index + 1)} />
      ) : (
        !review && (
          <Action
            title="Check answers"
            disabled={submit.isPending}
            onPress={() => submit.mutate()}
          />
        )
      )}
      {submit.error && <Failure error={submit.error} />}
    </>
  ) : (
    <Failure error={new Error("Question unavailable.")} />
  );
}
