import { buildFinalAnswersFromEngineSnapshot } from "@/lib/ucat/exam-attempt/build-final-answers";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

describe("buildFinalAnswersFromEngineSnapshot", () => {
  it("includes unanswered and unvisited questions in the final ledger", () => {
    const exam = {
      sourceType: "set",
      questions: [
        { id: "answered", questionSetId: "set-1", questionType: "multiple_choice" },
        { id: "blank", questionSetId: "set-1", questionType: "multiple_choice" },
      ],
    } as unknown as QuestionEngineExam;
    const state = {
      selectedAnswers: { answered: "option-1" },
      syllogismSnapshots: {},
      flaggedIds: [],
      visitedQuestionIds: ["answered"],
    } as unknown as ExamEngineSnapshot;

    expect(buildFinalAnswersFromEngineSnapshot(exam, state)).toEqual([
      expect.objectContaining({
        questionId: "answered",
        questionAnswerOptionId: "option-1",
      }),
      expect.objectContaining({
        questionId: "blank",
        questionAnswerOptionId: null,
      }),
    ]);
  });
});
