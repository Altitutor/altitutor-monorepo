import { useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Stack } from "expo-router/stack";
import { Copy, Failure, Loading, Screen } from "@/components/ui";
import { BottomToolbar } from "@/components/bottom-toolbar";
import { attemptKind, useAttempt } from "@/features/attempts/api";
import { Question } from "@/features/question-engine/components/question";
import { useReviewNavigation } from "@/features/attempts/review-navigation";
import { mapQuestionStemsToItems } from "@/features/question-engine/model/types";
import { InsightCard } from "@/features/progress/insight-card";
import { buildQuestionAttemptInsight } from "@/features/progress/attempt-insights";
import { formatDuration } from "@/features/attempts/metrics";
import { api } from "@/lib/api";
export default function AttemptQuestion() {
  const params = useLocalSearchParams<{
    id: string;
    kind: string;
    index: string;
  }>();
  const kind = attemptKind(params.kind);
  const q = useAttempt(kind, params.id);
  const [index, setIndex] = useState(() =>
    Math.max(0, Number(params.index) || 0),
  );
  const router = useRouter();
  const { setNavigation } = useReviewNavigation();
  const [reviewError, setReviewError] = useState<unknown>(null);
  const saving = useRef(Promise.resolve());
  const attempts = q.data?.questionAttempts;
  const item = attempts?.[index];
  const questions = useMemo(
    () =>
      q.data?.exam?.questions ??
      mapQuestionStemsToItems(q.data?.stemsSnapshot ?? []),
    [q.data],
  );
  const question = questions.find(
    (question) => question.id === item?.questionId,
  );
  const reviewPath = `/attempt-reviews/${kind === "practice" ? "practice_session" : kind === "mock" ? "mock_attempt" : "set_attempt"}/${params.id}`;
  useEffect(() => {
    if (!item || !attempts || !question) return;
    const questionId = item.questionId;
    // Serialise view writes: each response accumulates the durable viewed IDs.
    saving.current = saving.current
      .catch(() => undefined)
      .then(async () => {
        await api(reviewPath, {
          method: "PUT",
          body: { requiredQuestionIds: attempts.map((a) => a.questionId) },
        });
        await api(reviewPath, {
          method: "PATCH",
          body: { action: "view", questionId },
        });
        setReviewError(null);
      })
      .catch(setReviewError);
  }, [item, attempts, question, reviewPath]);
  function jump(next: number) {
    setIndex(next);
  }
  useEffect(() => {
    setNavigation({
      questions: (attempts ?? []).map((a, i) => ({
        index: i,
        number: a.questionNumber,
        result: a.result,
        timing: formatDuration(a.timeSpentSeconds),
        stemId: `${a.setIndex ?? 0}:${a.stemIndex}`,
        label: `Question ${a.questionNumber}`,
        answered: a.result !== "not_attempted",
        flagged: a.isFlagged,
        current: i === index,
      })),
      jump: (next) => {
        if (next >= 0 && next < (attempts?.length ?? 0)) setIndex(next);
      },
    });
    return () => setNavigation(null);
  }, [attempts, index, setNavigation]);
  return (
    <>
      <Screen key={index} bottomToolbar>
        <Stack.Screen
          options={{
            title: `Question ${item?.questionNumber ?? index + 1}`,
          }}
        />
        {q.isPending ? (
          <Loading />
        ) : q.error ? (
          <Failure error={q.error} retry={() => void q.refetch()} />
        ) : item && question ? (
          <>
            <InsightCard
              label="Question insight"
              insight={buildQuestionAttemptInsight({
                result: item.result,
                timeSpentSeconds: item.timeSpentSeconds,
                averageTimeSeconds: item.averageTimeSeconds,
                averageTimeSampleSize: item.averageTimeSampleSize,
                timeBurdenSeconds: item.timeBurdenSeconds,
                wasFlagged: item.isFlagged,
              })}
            />
            <Question
              key={question.id}
              question={question}
              answer={item.answerSnapshot ?? undefined}
              onAnswer={() => {}}
              review
            />
          </>
        ) : (
          <Copy muted>This question could not be loaded.</Copy>
        )}
        {reviewError ? <Failure error={reviewError} /> : null}
      </Screen>
      {attempts?.length ? (
        <BottomToolbar
          previous={() => jump(index - 1)}
          next={() => jump(index + 1)}
          hidePrevious={index === 0}
          hideNext={index + 1 >= attempts.length}
          onNavigator={() => {
            router.push({
              pathname: "/question-navigator",
              params: { mode: "review" },
            });
          }}
        />
      ) : null}
    </>
  );
}
