import type {
  QuestionEngineExam,
  QuestionEngineState,
} from "@/features/question-engine/model/types";
import { resolveSyncedSegmentEndsAt } from "@/lib/ucat/exam-attempt/timing";

const state = {
  phase: "question",
  currentIndex: 0,
} as QuestionEngineState;

const effectiveExam = {
  sourceType: "set",
  sourceId: "set-1",
  title: "Set 1",
  questions: [],
  instructionsScreens: [],
  setModeTiming: {
    setTimeLimitSeconds: 2400,
    instructionsTimeLimitSeconds: null,
  },
} satisfies QuestionEngineExam;

describe("attempt timing immutability", () => {
  it("starts a segment from the stored effective timing, not the client duration", () => {
    expect(
      resolveSyncedSegmentEndsAt({
        exam: effectiveExam,
        state,
        persistedEndsAt: null,
        startSegment: true,
        now: Date.parse("2026-09-03T00:00:00.000Z"),
      }),
    ).toBe("2026-09-03T00:40:00.000Z");
  });

  it("preserves an existing deadline during ordinary syncs", () => {
    expect(
      resolveSyncedSegmentEndsAt({
        exam: effectiveExam,
        state,
        persistedEndsAt: "2026-09-03T00:25:00.000Z",
        startSegment: false,
      }),
    ).toBe("2026-09-03T00:25:00.000Z");
  });

  it("clears the deadline after leaving a timed segment", () => {
    expect(
      resolveSyncedSegmentEndsAt({
        exam: effectiveExam,
        state: { ...state, phase: "marking" },
        persistedEndsAt: "2026-09-03T00:25:00.000Z",
        startSegment: false,
      }),
    ).toBeNull();
  });
});
