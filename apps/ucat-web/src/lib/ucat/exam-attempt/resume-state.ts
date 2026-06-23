import type { Json } from "@altitutor/shared";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

export type ResumeQuestionAttemptRow = {
  question_id: string;
  question_answer_option_id: string | null;
  answer_snapshot: Json | null;
  is_flagged: boolean;
};

export function mergeQuestionAttemptRowsIntoState(
  state: ExamEngineSnapshot,
  rows: ResumeQuestionAttemptRow[],
  questionIdsInOrder: string[] = [],
): ExamEngineSnapshot {
  const selectedAnswers = { ...state.selectedAnswers };
  const syllogismSnapshots = { ...state.syllogismSnapshots };
  const flaggedIds = new Set(state.flaggedIds);
  const visitedQuestionIds = new Set(state.visitedQuestionIds);

  for (const row of rows) {
    visitedQuestionIds.add(row.question_id);
    if (row.question_answer_option_id) {
      selectedAnswers[row.question_id] = row.question_answer_option_id;
    }

    const answerSnapshot = row.answer_snapshot as
      | {
          type?: string;
          answers?: Array<{
            question_answer_option_id?: string;
            answer?: boolean;
          }>;
        }
      | null;
    if (
      answerSnapshot?.type === "syllogism_v1" &&
      Array.isArray(answerSnapshot.answers)
    ) {
      syllogismSnapshots[row.question_id] = Object.fromEntries(
        answerSnapshot.answers.flatMap((answer) =>
          answer.question_answer_option_id
            ? [[answer.question_answer_option_id, Boolean(answer.answer)]]
            : [],
        ),
      );
    }

    if (row.is_flagged) flaggedIds.add(row.question_id);
    else flaggedIds.delete(row.question_id);
  }

  const recoveredQuestionIndex =
    state.phase === "instructions" && rows.length > 0
      ? questionIdsInOrder.reduce(
          (furthestIndex, questionId, index) =>
            visitedQuestionIds.has(questionId)
              ? Math.max(furthestIndex, index)
              : furthestIndex,
          -1,
        )
      : -1;

  return {
    ...state,
    ...(recoveredQuestionIndex >= 0
      ? {
          phase: "question" as const,
          currentIndex: recoveredQuestionIndex,
          showReadyDialog: false,
          showTimeExpiredDialog: false,
        }
      : {}),
    selectedAnswers,
    syllogismSnapshots,
    flaggedIds: [...flaggedIds],
    visitedQuestionIds: [...visitedQuestionIds],
  };
}
