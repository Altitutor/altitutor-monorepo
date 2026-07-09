import {
  defaultSettings,
  estimateSectionScore,
  generateTrajectory,
  resolveEffectivePracticePerWeek,
  weightEvidence,
  type AttemptEvidence,
} from "../model";

const NOW = new Date("2026-07-08T00:00:00Z").getTime();

function daysAgo(days: number): number {
  return NOW - days * 24 * 60 * 60 * 1000;
}

const baseEvidence: AttemptEvidence = {
  source: "mock",
  score: 700,
  scoredPoints: 36,
  totalPoints: 44,
  timestamp: daysAgo(0),
  wasTimed: true,
  examSpeedRatio: 1,
};

describe("score projection model", () => {
  it("weights mock evidence above set and practice evidence", () => {
    const settings = defaultSettings();
    const mock = weightEvidence(baseEvidence, settings, NOW);
    const set = weightEvidence({ ...baseEvidence, source: "set" }, settings, NOW);
    const practice = weightEvidence(
      { ...baseEvidence, source: "practice" },
      settings,
      NOW,
    );

    expect(mock.weight).toBeGreaterThan(set.weight);
    expect(set.weight).toBeGreaterThan(practice.weight);
  });

  it("downweights untimed and older evidence", () => {
    const settings = defaultSettings();
    const currentTimed = weightEvidence(baseEvidence, settings, NOW);
    const untimed = weightEvidence(
      { ...baseEvidence, wasTimed: false, examSpeedRatio: null },
      settings,
      NOW,
    );
    const old = weightEvidence(
      { ...baseEvidence, timestamp: daysAgo(settings.recencyHalfLifeDays) },
      settings,
      NOW,
    );

    expect(untimed.weight).toBeLessThan(currentTimed.weight);
    expect(old.weight).toBeCloseTo(currentTimed.weight * 0.5, 6);
  });

  it("does not show a prediction when effective evidence is too sparse", () => {
    const settings = defaultSettings();
    const estimate = estimateSectionScore(
      [{ ...baseEvidence, source: "practice", score: 800, totalPoints: 8 }],
      settings,
      NOW,
    );

    expect(estimate.currentEstimate).toBeNull();
    expect(estimate.effectiveEvidenceWeight).toBeLessThan(
      settings.minPredictionEvidenceWeight,
    );
    expect(estimate.confidence).toBe("low");
  });

  it("uses the weighted evidence average once enough evidence exists", () => {
    const settings = defaultSettings();
    const estimate = estimateSectionScore(
      [{ ...baseEvidence, score: 300 }],
      settings,
      NOW,
    );

    expect(estimate.currentEstimate).toBe(300);
    expect(estimate.confidence).toBe("low");
  });

  it("uses recent activity pace when enough effective practice exists", () => {
    const settings = defaultSettings();
    const estimate = estimateSectionScore(
      [
        baseEvidence,
        { ...baseEvidence, source: "set", timestamp: daysAgo(3) },
      ],
      settings,
      NOW,
    );
    const pace = resolveEffectivePracticePerWeek(
      estimate.weightedEvidence,
      settings,
      NOW,
    );

    expect(pace.source).toBe("recent_activity");
    expect(pace.pace).toBeGreaterThan(0);
  });

  it("generates ordered fixed-horizon trajectory bands", () => {
    const settings = defaultSettings();
    const trajectory = generateTrajectory({
      currentEstimate: 620,
      effectivePracticePerWeek: 120,
      settings,
      now: new Date(NOW),
    });
    const day90 = trajectory.horizons.find((point) => point.day === 90);

    expect(day90).toBeDefined();
    expect(day90!.pessimistic).toBeGreaterThanOrEqual(620);
    expect(day90!.realistic).toBeGreaterThanOrEqual(day90!.pessimistic);
    expect(day90!.optimistic).toBeGreaterThanOrEqual(day90!.realistic);
  });
});
