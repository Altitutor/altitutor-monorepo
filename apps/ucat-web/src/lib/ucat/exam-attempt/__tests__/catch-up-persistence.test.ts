import { buildCatchUpPersistence } from "@/lib/ucat/exam-attempt/catch-up-persistence";
import {
  examFromStoredTiming,
  resolveExamForCatchUp,
} from "@/lib/ucat/exam-attempt/load-exam-for-catch-up";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import type { ExamEngineSnapshot } from "@/lib/ucat/exam-attempt/types";

describe("buildCatchUpPersistence", () => {
  it("cannot finalize a timed set from its timing-only resume snapshot", () => {
    const exam = examFromStoredTiming({
      v: 1,
      exam: { sourceType: "set", sourceId: "set-1" },
      examTiming: {
        setModeTiming: {
          setTimeLimitSeconds: 60,
          instructionsTimeLimitSeconds: null,
        },
      },
      state: {},
    } as never);

    expect(() =>
      buildCatchUpPersistence(
        exam!,
        {
          phase: "question",
          selectedAnswers: {},
          placementSnapshots: {},
          responseSnapshots: {},
          flaggedIds: [],
          visitedQuestionIds: [],
        } as unknown as ExamEngineSnapshot,
        "2000-01-01T00:00:00.000Z",
        "set",
      ),
    ).toThrow(
      "This Answer scheme requires at least 2 options. The answer key references an unknown option.",
    );
  });

  it("loads delivered question content before catching up an expired set", async () => {
    const setQuery = {
      select: jest.fn(),
      eq: jest.fn(),
      maybeSingle: jest.fn(async () => ({
        data: {
          id: "set-1",
          time_limit_seconds: 60,
          stems: [
            {
              stem_id: "stem-1",
              questions_meta: [{ id: "question-1", index: 1 }],
            },
          ],
        },
        error: null,
      })),
    };
    setQuery.select.mockReturnValue(setQuery);
    setQuery.eq.mockReturnValue(setQuery);
    const stemQuery = {
      select: jest.fn(),
      in: jest.fn(async () => ({
        data: [
          {
            id: "stem-1",
            section_name: "Quantitative Reasoning",
            display_columns: 1,
            section_instructions_time_limit_seconds: null,
            questions: [
              {
                id: "question-1",
                index: 1,
                response_type: "multiple_choice",
                answer_scheme: "single_choice",
                answer_options: [
                  {
                    id: "option-1",
                    index: 1,
                    answer_key_value: "correct",
                  },
                  {
                    id: "option-2",
                    index: 2,
                    answer_key_value: null,
                  },
                ],
              },
            ],
          },
        ],
      })),
    };
    stemQuery.select.mockReturnValue(stemQuery);
    const reader = {
      from: jest.fn((table: string) =>
        table === "vstudent_ucat_question_set_detail" ? setQuery : stemQuery,
      ),
    };
    const stored = {
      v: 1,
      exam: { sourceType: "set", sourceId: "set-1" },
      examTiming: {
        setModeTiming: {
          setTimeLimitSeconds: 60,
          instructionsTimeLimitSeconds: null,
        },
      },
      state: {},
    } as never;

    const resolved = await resolveExamForCatchUp(
      {
        kind: "set",
        attemptId: "attempt-1",
        resourceId: "set-1",
      } as ActiveExamAttempt,
      { stored, readerClient: reader as never },
    );

    expect(resolved?.questions[0]?.options).toHaveLength(2);
    expect(reader.from).toHaveBeenCalledWith(
      "vstudent_ucat_question_set_detail",
    );
  });

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
      placementSnapshots: {},
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
        answerSnapshot: expect.objectContaining({ type: "ucat_response_v1" }),
        isFlagged: true,
      }),
    ]);
  });
});
