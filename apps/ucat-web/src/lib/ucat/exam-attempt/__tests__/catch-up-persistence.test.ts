import { buildCatchUpPersistence } from "@/lib/ucat/exam-attempt/catch-up-persistence";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

describe("buildCatchUpPersistence", () => {
  it("carries a canonical response through expiry into final persistence", () => {
    const exam = {
      sourceType: "set",
      sourceId: "set-1",
      title: "Set",
      instructionsScreens: [],
      setModeTiming: {
        setTimeLimitSeconds: 60,
        instructionsTimeLimitSeconds: null,
      },
      questions: [
        {
          id: "question-1",
          questionSetId: "set-1",
          questionType: "multiple_choice",
          responseType: "multiple_choice",
          answerScheme: "single_choice",
          options: [
            { id: "option-1", index: 0, answerKeyValue: "correct" },
            { id: "option-2", index: 1, answerKeyValue: null },
          ],
        },
      ],
    } as unknown as QuestionEngineExam;
    const state = {
      phase: "question",
      currentIndex: 0,
      selectedAnswers: { "question-1": "option-1" },
      syllogismSnapshots: {},
      responseSnapshots: {
        "question-1": {
          type: "ucat_response_v1",
          questionId: "question-1",
          answerScheme: "single_choice",
          response: {
            kind: "single_select",
            selectedOptionId: "option-1",
          },
        },
      },
      flaggedIds: ["question-1"],
      visitedQuestionIds: ["question-1"],
      instructionsIndex: 0,
      showReadyDialog: false,
      showTimeExpiredDialog: false,
      nextSegmentTimerStartedAt: null,
      reviewFilter: null,
      reviewFilterIndex: 0,
      reviewFilterIndicesSnapshot: null,
      viewingQuestionIndex: null,
    } as unknown as ExamEngineSnapshot;

    const result = buildCatchUpPersistence(
      exam,
      state,
      "2000-01-01T00:00:00.000Z",
      "set",
    );

    expect(result.caught.state.phase).toBe("marking");
    expect(result.finalAnswers).toEqual([
      expect.objectContaining({
        questionId: "question-1",
        questionAnswerOptionId: "option-1",
        answerSnapshot: expect.objectContaining({ type: "ucat_response_v1" }),
        isFlagged: true,
      }),
    ]);
  });
});
