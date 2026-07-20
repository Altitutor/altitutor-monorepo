import { buildFinalAnswersFromEngineSnapshot } from "@/lib/ucat/exam-attempt/build-final-answers";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

describe("buildFinalAnswersFromEngineSnapshot", () => {
  it("includes unanswered and unvisited questions in the final ledger", () => {
    const exam = {
      sourceType: "set",
      questions: [
        {
          id: "answered",
          questionSetId: "set-1",
          questionType: "multiple_choice",
        },
        {
          id: "blank",
          questionSetId: "set-1",
          questionType: "multiple_choice",
        },
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

  it("builds timed practice answers from the resumable engine snapshot", () => {
    const exam = {
      sourceType: "questionStem",
      sourceId: "practice-1",
      timePerQuestionSeconds: 60,
      questions: [
        {
          id: "syllogism",
          questionSetId: "set-1",
          questionType: "syllogism",
        },
      ],
    } as unknown as QuestionEngineExam;
    const state = {
      selectedAnswers: {},
      syllogismSnapshots: {
        syllogism: { "option-1": true, "option-2": false },
      },
      flaggedIds: ["syllogism"],
      visitedQuestionIds: ["syllogism"],
    } as unknown as ExamEngineSnapshot;

    expect(buildFinalAnswersFromEngineSnapshot(exam, state)).toEqual([
      {
        questionSetId: "set-1",
        questionId: "syllogism",
        questionAnswerOptionId: null,
        answerSnapshot: {
          type: "syllogism_v1",
          answers: [
            { question_answer_option_id: "option-1", answer: true },
            { question_answer_option_id: "option-2", answer: false },
          ],
        },
        isFlagged: true,
        wasTimed: true,
        mode: "question_stem",
      },
    ]);
  });
});
