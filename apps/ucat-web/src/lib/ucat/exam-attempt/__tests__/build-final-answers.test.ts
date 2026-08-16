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
          responseType: "multiple_choice",
          answerScheme: "single_choice",
          options: [
            { id: "option-1", index: 0, answerKeyValue: "correct" },
            { id: "option-2", index: 1, answerKeyValue: null },
          ],
        },
        {
          id: "blank",
          questionSetId: "set-1",
          responseType: "multiple_choice",
          answerScheme: "single_choice",
          options: [
            { id: "option-3", index: 0, answerKeyValue: "correct" },
            { id: "option-4", index: 1, answerKeyValue: null },
          ],
        },
      ],
    } as unknown as QuestionEngineExam;
    const state = {
      selectedAnswers: { answered: "option-1" },
      placementSnapshots: {},
      flaggedIds: [],
      visitedQuestionIds: ["answered"],
    } as unknown as ExamEngineSnapshot;

    expect(buildFinalAnswersFromEngineSnapshot(exam, state)).toEqual([
      expect.objectContaining({
        questionId: "answered",
        answerSnapshot: expect.objectContaining({ type: "ucat_response_v1" }),
      }),
      expect.objectContaining({
        questionId: "blank",
        answerSnapshot: expect.objectContaining({ type: "ucat_response_v1" }),
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
          responseType: "drag_and_drop",
          answerScheme: "decision_making_binary_placement",
          options: [
            { id: "option-1", index: 0, answerKeyValue: "yes" },
            { id: "option-2", index: 1, answerKeyValue: "no" },
            { id: "option-3", index: 2, answerKeyValue: "yes" },
            { id: "option-4", index: 3, answerKeyValue: "no" },
            { id: "option-5", index: 4, answerKeyValue: "yes" },
          ],
        },
      ],
    } as unknown as QuestionEngineExam;
    const state = {
      selectedAnswers: {},
      placementSnapshots: {
        syllogism: { "option-1": "yes", "option-2": "no" },
      },
      flaggedIds: ["syllogism"],
      visitedQuestionIds: ["syllogism"],
    } as unknown as ExamEngineSnapshot;

    expect(buildFinalAnswersFromEngineSnapshot(exam, state)).toEqual([
      {
        questionSetId: "set-1",
        questionId: "syllogism",
        answerSnapshot: {
          type: "ucat_response_v1",
          questionId: "syllogism",
          answerScheme: "decision_making_binary_placement",
          response: {
            kind: "placement",
            placements: { "option-1": "yes", "option-2": "no" },
          },
        },
        isFlagged: true,
        wasTimed: true,
        mode: "question_stem",
      },
    ]);
  });
});
