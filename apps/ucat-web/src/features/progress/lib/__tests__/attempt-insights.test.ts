import {
  buildAttemptOverallInsight,
  buildQuestionAttemptInsight,
  ATTEMPT_INSIGHT_RULE_IDS,
  QUESTION_INSIGHT_RULE_IDS,
  type AttemptRecentPerformance,
} from "../attempt-insights";
import {
  ATTEMPT_INSIGHT_PREVIEW_CASES,
  QUESTION_INSIGHT_PREVIEW_CASES,
} from "../attempt-insights.preview";

const recent: AttemptRecentPerformance = {
  sampleSize: 4,
  accuracyPercent: 68,
  examPacePercent: 96,
  examPaceSampleSize: 4,
  averageTimePerQuestionSeconds: 70,
  averageTimePerQuestionSampleSize: 4,
};

describe("buildAttemptOverallInsight", () => {
  it("recognises a meaningful accuracy improvement against similar attempts", () => {
    const insight = buildAttemptOverallInsight({
      accuracyPercent: 76,
      examPacePercent: 98,
      recentPerformance: recent,
    });

    expect(insight.title).toBe("Your accuracy moved in the right direction");
    expect(insight.ruleId).toBe("attempt.accuracy_improved");
    expect(insight.body).toContain("up 8 percentage points");
    expect(insight.tone).toBe("positive");
  });

  it("does not call a single earlier attempt a trend", () => {
    const insight = buildAttemptOverallInsight({
      accuracyPercent: 76,
      recentPerformance: { ...recent, sampleSize: 1 },
    });

    expect(insight.body).not.toContain("previous 1");
  });

  it("flags likely rushing when pace is high and accuracy is low", () => {
    const insight = buildAttemptOverallInsight({
      accuracyPercent: 58,
      examPacePercent: 119,
      recentPerformance: { ...recent, accuracyPercent: 63 },
    });

    expect(insight.title).toBe(
      "A little less speed may help you get more questions right",
    );
    expect(insight.body).toContain("1.19x exam speed");
  });

  it("protects accuracy when a learner is correct but still building speed", () => {
    const insight = buildAttemptOverallInsight({
      accuracyPercent: 86,
      examPacePercent: 74,
      recentPerformance: null,
    });

    expect(insight.title).toBe("Accuracy is leading your pace");
    expect(insight.body).toContain("0.74x exam speed");
    expect(insight.body).toContain("repeated exposure");
  });
});

describe("buildQuestionAttemptInsight", () => {
  it("shows a positive insight for a correct answer at a sensible pace", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 52,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 12,
    });

    expect(insight.title).toBe("Correct at a solid pace");
    expect(insight.body).toContain("students who answered it correctly");
  });

  it("varies the success message when the answer was especially efficient", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 35,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 12,
    });

    expect(insight.title).toBe("Efficient and correct");
    expect(insight.body).toContain("42% faster");
  });

  it("treats slow correct work as a foundation rather than a failure", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 120,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 12,
    });

    expect(insight.title).toBe("Correct, but slower than it needed to be");
    expect(insight.body).toContain("118% longer");
  });

  it("always coaches an incorrect answer when timing is unavailable", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 12,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 3,
    });

    expect(insight.title).toBe("Find where your approach went wrong");
    expect(insight.body).toContain("first point where they diverged");
  });

  it("acknowledges a useful flag even without a timing signal", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 55,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
      wasFlagged: true,
    });

    expect(insight.title).toBe("Good call to flag this one");
    expect(insight.body).toContain("explanation below");
  });

  it("distinguishes rushed and overlong incorrect answers", () => {
    const rushed = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 25,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
    });
    const overlong = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 100,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
    });

    expect(rushed.title).toBe("You answered too quickly and got it wrong");
    expect(overlong.title).toBe("You spent too long and still got it wrong");
  });

  it("shows method-focused coaching for an ordinary incorrect answer", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 60,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
    });

    expect(insight.title).toBe(
      "Your timing was fine — the reasoning needs work",
    );
  });

  it("incorporates the selected wrong option's explanation", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 60,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
      wrongAnswerExplanations: [
        "This conclusion assumes every candidate used the same method, which the passage does not establish.",
      ],
    });

    expect(insight.body).toContain("For the answer you chose:");
    expect(insight.body).toContain(
      "This conclusion assumes every candidate used the same method",
    );
    expect(insight.body).not.toContain(
      "Use the explanation to find where your reasoning diverged",
    );
  });

  it("incorporates the wrong statement's explanation for a partial result", () => {
    const insight = buildQuestionAttemptInsight({
      result: "partial",
      timeSpentSeconds: 60,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
      wrongAnswerExplanations: [
        "The passage says some candidates improved, not that every candidate did.",
        "The passage describes an association rather than proving a cause.",
      ],
    });

    expect(insight.ruleId).toBe("question.partial_default");
    expect(insight.body).toContain("For the answers that missed:");
    expect(insight.body).toContain("some candidates improved");
    expect(insight.body).toContain("association rather than proving a cause");
    expect(insight.body).not.toContain("what kept this from full marks");
  });

  it("keeps generic partial coaching when the wrong statement has no explanation", () => {
    const insight = buildQuestionAttemptInsight({
      result: "partial",
      timeSpentSeconds: 60,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
    });

    expect(insight.body).toBe(
      "Use the explanation below to see what kept this from full marks.",
    );
  });

  it("falls back to generic coaching when the selected option has no explanation", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 60,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
      wrongAnswerExplanations: ["   "],
    });

    expect(insight.body).toContain(
      "Use the explanation to find where your reasoning diverged",
    );
  });

  it("uses successful timing to coach an unanswered question", () => {
    const insight = buildQuestionAttemptInsight({
      result: "not_attempted",
      timeSpentSeconds: 100,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
    });

    expect(insight.title).toBe("You spent too long without answering");
  });
});

describe("insight preview coverage", () => {
  it("has a preview case for every attempt and question rule", () => {
    expect(
      new Set(
        ATTEMPT_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildAttemptOverallInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(ATTEMPT_INSIGHT_RULE_IDS));
    expect(
      new Set(
        QUESTION_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildQuestionAttemptInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(QUESTION_INSIGHT_RULE_IDS));
  });
});
