import {
  getClientPracticeQuestionDisplaySeconds,
  getOpenIntervalSeconds,
  getQuestionDisplaySeconds,
  switchClientPracticeQuestionTiming,
} from "@/features/question-engine/lib/practice-question-timing";

describe("practice-question-timing", () => {
  it("computes open interval seconds from startedAt", () => {
    const active = {
      questionId: "q1",
      startedAt: "2026-01-01T00:00:00.000Z",
      segmentEndsAt: null,
    };
    expect(
      getOpenIntervalSeconds(active, Date.parse("2026-01-01T00:00:05.000Z")),
    ).toBe(5);
  });

  it("caps open interval at segment end", () => {
    const active = {
      questionId: "q1",
      startedAt: "2026-01-01T00:00:00.000Z",
      segmentEndsAt: "2026-01-01T00:00:03.000Z",
    };
    expect(
      getOpenIntervalSeconds(active, Date.parse("2026-01-01T00:00:10.000Z")),
    ).toBe(3);
  });

  it("adds open interval only for the active question", () => {
    const persisted = { q1: 10, q2: 4 };
    const active = {
      questionId: "q2",
      startedAt: "2026-01-01T00:00:00.000Z",
      segmentEndsAt: null,
    };
    expect(
      getQuestionDisplaySeconds(
        "q1",
        persisted,
        active,
        Date.parse("2026-01-01T00:00:10.000Z"),
      ),
    ).toBe(10);
    expect(
      getQuestionDisplaySeconds(
        "q2",
        persisted,
        active,
        Date.parse("2026-01-01T00:00:10.000Z"),
      ),
    ).toBe(14);
  });

  it("accumulates client timing when switching questions", () => {
    let state = switchClientPracticeQuestionTiming(
      {
        millisecondsByQuestionId: {},
        activeQuestionId: null,
        activeStartedAtMs: null,
      },
      "q1",
      0,
    );
    state = switchClientPracticeQuestionTiming(state, "q2", 5000);
    expect(getClientPracticeQuestionDisplaySeconds("q1", state, 5000)).toBe(5);
    expect(getClientPracticeQuestionDisplaySeconds("q2", state, 8000)).toBe(3);
  });

  it("preserves sub-second intervals across question switches", () => {
    let state = switchClientPracticeQuestionTiming(
      {
        millisecondsByQuestionId: {},
        activeQuestionId: null,
        activeStartedAtMs: null,
      },
      "q1",
      0,
    );
    state = switchClientPracticeQuestionTiming(state, "q2", 600);
    state = switchClientPracticeQuestionTiming(state, "q1", 1200);

    expect(getClientPracticeQuestionDisplaySeconds("q1", state, 1600)).toBe(1);
  });
});
