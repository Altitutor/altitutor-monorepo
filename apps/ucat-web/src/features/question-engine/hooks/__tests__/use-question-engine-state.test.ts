import type { QuestionEngineState } from "@/features/question-engine/model/types";
import { applyNeedMoreStemsResult } from "@/features/question-engine/hooks/use-question-engine-state";

function loadingMoreState(): QuestionEngineState {
  return {
    phase: "loadingMore",
    currentIndex: 4,
    viewingQuestionIndex: null,
    practiceAnswerUnitStartIndex: 0,
    practiceAnswerUnitEndIndex: 3,
    loadingMoreTargetIndex: 4,
    loadingMoreExcludeStemIds: ["stem-1"],
  } as QuestionEngineState;
}

describe("applyNeedMoreStemsResult", () => {
  it("advances to a loaded stem and clears the retained answer view", () => {
    const current = {
      ...loadingMoreState(),
      currentIndex: 3,
      viewingQuestionIndex: 3,
    };
    const next = applyNeedMoreStemsResult(current, {
      status: "loaded",
      stems: [
        {
          id: "stem-2",
          questionSetId: "set-1",
          sectionName: "Decision Making",
          sectionDisplayColumns: 1,
          stemText: "Stem",
          questions: [],
        },
      ],
    });

    expect(next).toMatchObject({
      phase: "question",
      currentIndex: 4,
      viewingQuestionIndex: null,
      practiceAnswerUnitStartIndex: undefined,
      practiceAnswerUnitEndIndex: undefined,
      loadingMoreTargetIndex: undefined,
      loadingMoreExcludeStemIds: undefined,
    });
  });

  it("returns to the final answer when quota prevents loading another stem", () => {
    const next = applyNeedMoreStemsResult(loadingMoreState(), {
      status: "quotaReached",
    });

    expect(next).toMatchObject({
      phase: "practiceAnswer",
      currentIndex: 3,
      viewingQuestionIndex: 3,
      practiceAnswerUnitStartIndex: 0,
      practiceAnswerUnitEndIndex: 3,
      loadingMoreTargetIndex: undefined,
      loadingMoreExcludeStemIds: undefined,
    });
  });

  it("only completes practice when there are genuinely no more stems", () => {
    const next = applyNeedMoreStemsResult(loadingMoreState(), {
      status: "exhausted",
    });

    expect(next).toMatchObject({
      phase: "practiceComplete",
      viewingQuestionIndex: null,
      practiceAnswerUnitStartIndex: undefined,
      practiceAnswerUnitEndIndex: undefined,
      loadingMoreTargetIndex: undefined,
      loadingMoreExcludeStemIds: undefined,
    });
  });

  it("completes accumulated practice when review-at-end is exhausted", () => {
    const next = applyNeedMoreStemsResult(
      loadingMoreState(),
      { status: "exhausted" },
      { reviewAtEnd: true },
    );

    expect(next).toMatchObject({
      phase: "practiceComplete",
      viewingQuestionIndex: null,
      loadingMoreTargetIndex: undefined,
      loadingMoreExcludeStemIds: undefined,
    });
  });

  it("completes accumulated practice when quota stops review-at-end delivery", () => {
    const next = applyNeedMoreStemsResult(
      loadingMoreState(),
      { status: "quotaReached" },
      { reviewAtEnd: true },
    );

    expect(next).toMatchObject({
      phase: "practiceComplete",
      currentIndex: 3,
      viewingQuestionIndex: null,
      loadingMoreTargetIndex: undefined,
      loadingMoreExcludeStemIds: undefined,
    });
  });
});
