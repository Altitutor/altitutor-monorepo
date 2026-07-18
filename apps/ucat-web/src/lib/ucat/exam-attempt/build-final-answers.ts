import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { FinalExamQuestionAttemptInput } from "@/lib/ucat/exam-attempt/finalize-attempt";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

function isQuestionTimed(
  exam: QuestionEngineExam,
  questionIndex: number,
): boolean {
  if (exam.sourceType === "set") {
    return (exam.setModeTiming?.setTimeLimitSeconds ?? 0) > 0;
  }
  if (exam.sourceType !== "mock") return false;
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
  if (exam.sourceType !== "set" && exam.sourceType !== "mock") return [];

  return exam.questions.map((question, questionIndex) => {
    const selectedOptionId = state.selectedAnswers[question.id];
    const syllogismSnapshot = state.syllogismSnapshots?.[question.id];
    const isSyllogism = question.questionType === "syllogism";
    const answer: FinalExamQuestionAttemptInput = {
      questionSetId: question.questionSetId,
      questionId: question.id,
      questionAnswerOptionId: isSyllogism ? null : (selectedOptionId ?? null),
      isFlagged: state.flaggedIds.includes(question.id),
      wasTimed: isQuestionTimed(exam, questionIndex),
      mode: exam.sourceType === "mock" ? "mock" : "set",
    };

    if (isSyllogism && syllogismSnapshot) {
      answer.answerSnapshot = {
        type: "syllogism_v1",
        answers: Object.entries(syllogismSnapshot).map(([optionId, value]) => ({
          question_answer_option_id: optionId,
          answer: value,
        })),
      };
    }

    return answer;
  });
}
