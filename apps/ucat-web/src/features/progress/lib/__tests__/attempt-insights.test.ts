import {
  buildAttemptOverallInsight,
  buildQuestionAttemptInsight,
  type AttemptRecentPerformance,
} from "../attempt-insights";

const recent: AttemptRecentPerformance = {
  sampleSize: 4,
  accuracyPercent: 68,
  examPacePercent: 96,
  examPaceSampleSize: 4,
  averageTimePerQuestionSeconds: 70,
  averageTimePerQuestionSampleSize: 4,
};

describe("buildAttemptOverallInsight", () => {
  it("recognises a meaningful accuracy improvement against comparable attempts", () => {
    const insight = buildAttemptOverallInsight({
      accuracyPercent: 76,
      examPacePercent: 98,
      recentPerformance: recent,
    });

    expect(insight.title).toBe("Your accuracy moved in the right direction");
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
      "A little less speed may convert more questions",
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
  it("hides the insight for a correct answer at a sensible pace", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 52,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 12,
    });

    expect(insight).toBeNull();
  });

  it("varies the success message when the answer was especially efficient", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 35,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 12,
    });

    expect(insight?.title).toBe("Nicely done");
  });

  it("treats slow correct work as a foundation rather than a failure", () => {
    const insight = buildQuestionAttemptInsight({
      result: "correct",
      timeSpentSeconds: 120,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 12,
    });

    expect(insight?.title).toBe("You got there");
    expect(insight?.body).toContain("let speed follow understanding");
  });

  it("defers to the explanation when there is no distinct coaching signal", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 12,
      averageTimeSeconds: 55,
      averageTimeSampleSize: 3,
    });

    expect(insight).toBeNull();
  });

  it("acknowledges a useful flag even without a timing signal", () => {
    const insight = buildQuestionAttemptInsight({
      result: "incorrect",
      timeSpentSeconds: 55,
      averageTimeSeconds: 60,
      averageTimeSampleSize: 10,
      wasFlagged: true,
    });

    expect(insight?.title).toBe("Good call to flag this one");
    expect(insight?.body).toContain("explanation below");
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

    expect(rushed?.title).toBe("This one looks rushed");
    expect(overlong?.title).toBe("This one took more time than it returned");
  });
});
