import { getTimedSegmentKey } from "@/features/question-engine/lib/timed-segment-key";
import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";

describe("getTimedSegmentKey", () => {
  it("uses one stable segment for session-timed practice", () => {
    const exam = {
      sourceType: "questionStem",
      practiceSessionTimeLimitSeconds: 600,
    } as QuestionEngineExam;
    const state = {
      phase: "question",
      instructionsIndex: 0,
      currentIndex: 7,
      mockCurrentSetIndex: undefined,
      reviewFilter: null,
    } as QuestionEngineState;

    expect(getTimedSegmentKey(exam, state)).toBe("practice-session");
  });
});
