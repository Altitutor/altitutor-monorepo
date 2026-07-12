import {
  formatAttemptTableMetricValue,
  getAttemptTableMetricColumn,
  resolveAttemptTableMetric,
} from "../attempt-table-metric";

describe("attempt-table-metric", () => {
  it("maps graph metrics to table columns and falls back for count metrics", () => {
    expect(resolveAttemptTableMetric("scaled_score")).toBe("scaled_score");
    expect(resolveAttemptTableMetric("percentage")).toBe("percentage");
    expect(resolveAttemptTableMetric("time_taken")).toBe("time_taken");
    expect(resolveAttemptTableMetric("exam_speed")).toBe("exam_speed");
    expect(resolveAttemptTableMetric("attempt_count")).toBe("scaled_score");
    expect(resolveAttemptTableMetric("scaled_score", "practice")).toBe(
      "percentage",
    );
    expect(resolveAttemptTableMetric("attempt_count", "practice")).toBe(
      "questions",
    );
    expect(resolveAttemptTableMetric("question_speed", "practice")).toBe(
      "percentage",
    );
  });

  it("formats questions metric", () => {
    expect(
      formatAttemptTableMetricValue(
        "questions",
        {
          scorePoints: null,
          totalPoints: null,
          timeTakenSeconds: null,
          questionCount: 12,
        },
        "practice",
      ),
    ).toBe("12");
    expect(getAttemptTableMetricColumn("questions", "practice").label).toBe(
      "Questions",
    );
  });

  it("formats metric values for set, mock, and practice scopes", () => {
    const attempt = {
      scaledScore: 720,
      scaledScoreMax: 2700,
      scorePoints: 30,
      totalPoints: 40,
      timeTakenSeconds: 1500,
      setTimeLimitSeconds: 1800,
      studentExamSpeed: 1.2,
    };

    expect(formatAttemptTableMetricValue("scaled_score", attempt, "set")).toBe(
      "720",
    );
    expect(formatAttemptTableMetricValue("scaled_score", attempt, "mock")).toBe(
      "720 / 2700",
    );
    expect(formatAttemptTableMetricValue("percentage", attempt, "set")).toBe(
      "75%",
    );
    expect(formatAttemptTableMetricValue("time_taken", attempt, "set")).toBe(
      "25:00 / 30:00",
    );
    expect(
      formatAttemptTableMetricValue("time_taken", attempt, "practice"),
    ).toBe("25:00");
    expect(formatAttemptTableMetricValue("exam_speed", attempt, "set")).toBe(
      "120.0%",
    );
  });

  it("returns scoped column labels", () => {
    expect(getAttemptTableMetricColumn("percentage", "set").label).toBe(
      "Percentage",
    );
    expect(getAttemptTableMetricColumn("exam_speed", "mock").label).toBe(
      "Exam speed",
    );
    expect(getAttemptTableMetricColumn("time_taken", "practice").label).toBe(
      "Time taken",
    );
  });
});
