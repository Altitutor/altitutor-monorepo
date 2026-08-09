import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { FinalExamQuestionAttemptInput } from "@/lib/ucat/exam-attempt/finalize-attempt";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";
import { snapshotQuestionResponse } from "@/features/question-engine/lib/response-state";

function isQuestionTimed(
  exam: QuestionEngineExam,
  questionIndex: number,
): boolean {
  if (exam.sourceType === "set") {
    return (exam.setModeTiming?.setTimeLimitSeconds ?? 0) > 0;
  }
  if (exam.sourceType !== "mock") {
    return (exam.timePerQuestionSeconds ?? 0) > 0;
  }
  const segment = exam.mockTimingSegments?.find(
    (item) =>
      item.type === "questions" &&
      questionIndex >= item.questionStartIndex &&
      questionIndex <= item.questionEndIndex,
  );
  return segment?.type === "questions" && (segment.timeLimitSeconds ?? 0) > 0;
}

/** Builds a complete result ledger, including visited or unvisited blanks. */
export function buildFinalAnswersFromEngineSnapshot(
  exam: QuestionEngineExam,
  state: ExamEngineSnapshot,
): FinalExamQuestionAttemptInput[] {
  return exam.questions.map((question, questionIndex) => {
    const selectedOptionId = state.selectedAnswers[question.id];
    const syllogismSnapshot = state.syllogismSnapshots?.[question.id];
    const isPlacement =
      question.answerScheme === "decision_making_binary_placement" ||
      question.questionType === "syllogism";
    const answer: FinalExamQuestionAttemptInput = {
      questionSetId: question.questionSetId,
      questionId: question.id,
      questionAnswerOptionId: isPlacement ? null : (selectedOptionId ?? null),
      answerSnapshot: snapshotQuestionResponse(
        question,
        selectedOptionId,
        syllogismSnapshot,
      ),
      isFlagged: state.flaggedIds.includes(question.id),
      wasTimed: isQuestionTimed(exam, questionIndex),
      mode:
        exam.sourceType === "mock"
          ? "mock"
          : exam.sourceType === "set"
            ? "set"
            : exam.sourceType === "questions"
              ? "question"
              : "question_stem",
    };

    return answer;
  });
}
