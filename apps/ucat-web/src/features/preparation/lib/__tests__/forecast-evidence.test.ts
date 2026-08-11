import { derivePreparationForecastEvidence } from "@/features/preparation/lib/forecast-evidence";
import { CURRENT_PREPARATION_VERSIONS } from "@/features/preparation/lib/policy";

describe("preparation forecast evidence", () => {
  it("uses core-task adherence and keeps only compatible trajectory history", () => {
    const currentSnapshot = {
      versions: CURRENT_PREPARATION_VERSIONS,
      sectionTargets: { vr: 730, dm: 730, qr: 740 },
      currentScore: { status: "available", currentEstimate: 1800 },
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
          generatedAt: "2026-01-20T00:00:00.000Z",
          projectionSnapshot: currentSnapshot,
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
      activeGenerationTasks: [
        { scheduledDate: "2026-01-20", status: "completed", optional: false },
        { scheduledDate: "2026-01-21", status: "planned", optional: false },
        { scheduledDate: "2026-01-21", status: "planned", optional: true },
      ],
      timingSessions: [
        {
          id: "recent-vr",
          sectionId: "vr",
          source: "practice",
          completedAt: "2026-01-10T00:00:00.000Z",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.7,
          sectionEquivalents: 1.5,
          breadth: "broad",
          categoryIds: [],
        },
        {
          id: "recent-sjt",
          sectionId: "sjt",
          source: "practice",
          completedAt: "2026-01-10T00:00:00.000Z",
          prescribedPace: 1,
          observedPace: 1,
          accuracy: 0.7,
          sectionEquivalents: 3,
          breadth: "broad",
          categoryIds: [],
        },
      ],
      cognitiveSectionIds: new Set(["vr", "dm", "qr"]),
    });

    expect(result).toMatchObject({
      previousSectionTargets: { vr: 730, dm: 730, qr: 740 },
      expectedAdherence: 0.5,
      recentCoreSectionEquivalentsPerWeek: 0.5,
      history: [
        { date: "2026-01-13", currentEstimate: 1750 },
        { date: "2026-01-20", currentEstimate: 1800 },
      ],
    });
    expect(result.adherenceUncertainty).toBeGreaterThan(0);
  });
});
