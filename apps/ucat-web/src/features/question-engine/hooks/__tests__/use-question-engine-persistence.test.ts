import {
  buildFinalExamQuestionAttempts,
  shouldPersistAnswerImmediately,
} from "@/features/question-engine/hooks/use-question-engine-persistence";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";

const exam: QuestionEngineExam = {
  sourceType: "set",
  sourceId: "set-1",
  title: "Set",
  instructionsScreens: [],
  setModeTiming: {
    setTimeLimitSeconds: 600,
    instructionsTimeLimitSeconds: 90,
  },
  questions: [
    {
      id: "question-1",
      index: 0,
      questionSetId: "set-1",
      stemId: "stem-1",
      sectionName: "Decision Making",
      sectionDisplayColumns: 1,
      stemText: "Stem",
      questionText: "Seen question",
      questionType: "multiple_choice",
      options: [],
    },
    {
      id: "question-2",
      index: 1,
      questionSetId: "set-1",
      stemId: "stem-2",
      sectionName: "Decision Making",
      sectionDisplayColumns: 1,
      stemText: "Stem",
      questionText: "Unseen question",
      questionType: "multiple_choice",
      options: [],
    },
  ],
};

describe("buildFinalExamQuestionAttempts", () => {
  it("persists every set question, including completely unseen questions", () => {
    const state = {
      selectedAnswers: { "question-1": "option-1" },
      syllogismSnapshots: {},
      flaggedIds: [],
    } satisfies Pick<
      QuestionEngineState,
      "selectedAnswers" | "syllogismSnapshots" | "flaggedIds"
    >;

    expect(buildFinalExamQuestionAttempts("set", exam, state)).toEqual([
      expect.objectContaining({
        questionId: "question-1",
        questionAnswerOptionId: "option-1",
      }),
      expect.objectContaining({
        questionId: "question-2",
        questionAnswerOptionId: null,
      }),
    ]);
  });

  it("persists unseen mock questions under the correct set and timing segment", () => {
    const mockExam: QuestionEngineExam = {
      ...exam,
      sourceType: "mock",
      sourceId: "mock-1",
      setModeTiming: undefined,
      questions: [
        exam.questions[0],
        { ...exam.questions[1], questionSetId: "set-2" },
      ],
      mockTimingSegments: [
        {
          type: "questions",
          setIndex: 0,
          questionStartIndex: 0,
          questionEndIndex: 1,
          timeLimitSeconds: null,
        },
        {
          type: "questions",
          setIndex: 1,
          questionStartIndex: 1,
          questionEndIndex: 2,
          timeLimitSeconds: 600,
        },
      ],
    };

    const attempts = buildFinalExamQuestionAttempts("mock", mockExam, {
      selectedAnswers: {},
      syllogismSnapshots: {},
      flaggedIds: [],
    });

    expect(attempts).toEqual([
      expect.objectContaining({
        questionId: "question-1",
        questionSetId: "set-1",
        questionAnswerOptionId: null,
        wasTimed: false,
      }),
      expect.objectContaining({
        questionId: "question-2",
        questionSetId: "set-2",
        questionAnswerOptionId: null,
        wasTimed: true,
      }),
    ]);
  });
});

describe("shouldPersistAnswerImmediately", () => {
  it.each([
    { mode: "set" as const, practiceSessionId: null },
    { mode: "mock" as const, practiceSessionId: null },
    { mode: "questions" as const, practiceSessionId: "practice-1" },
  ])(
    "uses the managed snapshot/final batch for $mode attempts",
    ({ mode, practiceSessionId }) => {
      expect(
        shouldPersistAnswerImmediately({
          examAttemptManaged: true,
          mode,
          practiceSessionId,
        }),
      ).toBe(false);
    },
  );

  it("keeps immediate persistence for unmanaged and standalone question modes", () => {
    expect(
      shouldPersistAnswerImmediately({
        examAttemptManaged: false,
        mode: "set",
      }),
    ).toBe(true);
    expect(
      shouldPersistAnswerImmediately({
        examAttemptManaged: true,
        mode: "questions",
      }),
    ).toBe(true);
  });
});
