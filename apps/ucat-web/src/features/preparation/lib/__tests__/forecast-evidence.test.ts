import {
  derivePreparationForecastEvidence,
  mergeCurrentPreparationHistory,
} from "@/features/preparation/lib/forecast-evidence";
import { CURRENT_PREPARATION_VERSIONS } from "@/features/preparation/lib/policy";

describe("preparation forecast evidence", () => {
  it("includes first-load current evidence and replaces an existing same-day point", () => {
    const currentScore = {
      status: "available" as const,
      currentEstimate: 1900,
      confidence: "medium" as const,
      uncertainty: 55,
      sections: [
        {
          sectionId: "vr",
          sectionNumber: 1,
          currentEstimate: 620,
          confidence: "medium" as const,
          uncertainty: 32,
          evidenceCount: 5,
          evidenceStatus: "available" as const,
        },
      ],
    };

    expect(
      mergeCurrentPreparationHistory(
        [],
        currentScore,
        "2026-01-21",
        "model-v1",
      ),
    ).toEqual([
      expect.objectContaining({ date: "2026-01-21", currentEstimate: 1900 }),
    ]);
    expect(
      mergeCurrentPreparationHistory(
        [
          {
            date: "2026-01-20",
            currentEstimate: 1800,
            modelVersion: "model-v1",
          },
          {
            date: "2026-01-21",
            currentEstimate: 1850,
            modelVersion: "model-v1",
          },
        ],
        currentScore,
        "2026-01-21",
        "model-v1",
      ),
    ).toEqual([
      expect.objectContaining({ date: "2026-01-20", currentEstimate: 1800 }),
      expect.objectContaining({ date: "2026-01-21", currentEstimate: 1900 }),
    ]);
  });

  it("uses six weeks of recency-weighted behavior and stable plan uptake", () => {
    const currentSnapshot = {
      versions: CURRENT_PREPARATION_VERSIONS,
      sectionTargets: { vr: 730, dm: 730, qr: 740 },
      currentScore: {
        status: "available",
        currentEstimate: 1800,
        confidence: "high",
        uncertainty: 45,
        sections: [
          {
            sectionId: "vr",
            currentEstimate: 600,
            confidence: "medium",
            uncertainty: 30,
            evidenceCount: 4,
          },
        ],
      },
    };
    const result = derivePreparationForecastEvidence({
      today: "2026-01-21",
      versions: CURRENT_PREPARATION_VERSIONS,
      activePlanSnapshot: {
        generatedAt: "2026-01-20T00:00:00.000Z",
        projectionSnapshot: currentSnapshot,
      },
      historySnapshots: [
        {
          generatedAt: "2026-01-19T23:30:00.000Z",
          snapshotDate: "2026-01-20",
          projectionSnapshot: currentSnapshot,
        },
        {
          generatedAt: "2026-01-20T12:00:00.000Z",
          snapshotDate: "2026-01-20",
          projectionSnapshot: {
            ...currentSnapshot,
            currentScore: {
              ...currentSnapshot.currentScore,
              currentEstimate: 1810,
              uncertainty: 40,
            },
          },
        },
        {
          generatedAt: "2026-01-13T00:00:00.000Z",
          projectionSnapshot: {
            ...currentSnapshot,
            currentScore: { status: "available", currentEstimate: 1750 },
          },
        },
        {
          generatedAt: "2026-01-06T00:00:00.000Z",
          projectionSnapshot: {
            versions: {
              ...CURRENT_PREPARATION_VERSIONS,
              trajectoryModel: "incompatible-v0",
            },
            currentScore: { status: "available", currentEstimate: 1600 },
          },
        },
        {
          generatedAt: "2025-12-30T00:00:00.000Z",
          projectionSnapshot: {
            versions: {
              ...CURRENT_PREPARATION_VERSIONS,
              engine: "incompatible-engine-v0",
            },
            currentScore: { status: "available", currentEstimate: 1500 },
          },
        },
      ],
      recentPlanTaskHistory: [
        {
          scheduledDate: "2026-01-20",
          status: "completed",
          optional: false,
          generationId: "old",
          generationGeneratedAt: "2026-01-18T00:00:00.000Z",
        },
        {
          scheduledDate: "2026-01-20",
          status: "completed",
          optional: false,
          generationId: "current",
          generationGeneratedAt: "2026-01-19T00:00:00.000Z",
        },
        {
          scheduledDate: "2026-01-20",
          status: "skipped",
          optional: false,
          generationId: "current",
          generationGeneratedAt: "2026-01-19T00:00:00.000Z",
        },
        { scheduledDate: "2026-01-21", status: "planned", optional: false },
        { scheduledDate: "2026-01-21", status: "planned", optional: true },
      ],
      timingSessions: Array.from({ length: 6 }, (_, week) => ({
        id: `recent-vr-${week}`,
        sectionId: "vr",
        source: "practice" as const,
        completedAt: `${["2026-01-21", "2026-01-14", "2026-01-07", "2025-12-31", "2025-12-24", "2025-12-17"][week]}T00:00:00.000Z`,
        prescribedPace: 1,
        observedPace: 1,
        accuracy: 0.7,
        sectionEquivalents: 1,
        breadth: "broad" as const,
        categoryIds: [],
      })).concat([
        {
          id: "recent-sjt",
          sectionId: "sjt",
          source: "practice" as const,
          completedAt: "2026-01-21T00:00:00.000Z",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.7,
          sectionEquivalents: 3,
          breadth: "broad" as const,
          categoryIds: [],
        },
      ]),
      cognitiveSectionIds: new Set(["vr", "dm", "qr"]),
    });

    expect(result).toMatchObject({
      previousSectionTargets: { vr: 730, dm: 730, qr: 740 },
      expectedPlanUptake: 0.5,
      recentCoreSectionEquivalentsPerWeek: 1,
      recentCoreSectionEquivalentsPerWeekBySection: { vr: 1 },
      history: [
        { date: "2026-01-13", currentEstimate: 1750 },
        {
          date: "2026-01-20",
          currentEstimate: 1810,
          confidence: "high",
          uncertainty: 40,
          effectiveEvidenceWeight: 4,
          sections: {
            vr: {
              currentEstimate: 600,
              confidence: "medium",
              uncertainty: 30,
              evidenceCount: 4,
            },
          },
        },
      ],
    });
    expect(result.planUptakeUncertainty).toBeGreaterThan(0);
  });

  it("uses a cautious plan-uptake prior when no plan day is due", () => {
    const result = derivePreparationForecastEvidence({
      today: "2026-01-21",
      versions: CURRENT_PREPARATION_VERSIONS,
      activePlanSnapshot: null,
      historySnapshots: [],
      recentPlanTaskHistory: [],
      timingSessions: [],
      cognitiveSectionIds: new Set(["vr", "dm", "qr"]),
    });

    expect(result).toMatchObject({
      expectedPlanUptake: 0.5,
      recentCoreSectionEquivalentsPerWeek: null,
      recentCoreSectionEquivalentsPerWeekBySection: {},
    });
  });
});
