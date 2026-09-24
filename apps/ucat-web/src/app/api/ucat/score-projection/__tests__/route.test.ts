import { GET } from "@/app/api/ucat/score-projection/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { loadLatestPreparationSnapshot } from "@/features/preparation/server/preparation-snapshot";
import {
  PREPARATION_SANDBOX_PERSONAS,
  runPreparationSandboxCase,
} from "@/features/preparation/testing/sandbox";
import { buildPreparationTrajectory } from "@/features/preparation/lib/trajectory";

jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      headers: new Headers(),
      json: async () => body,
    }),
  },
}));
jest.mock("@/features/preparation/server/preparation-snapshot", () => ({
  loadLatestPreparationSnapshot: jest.fn(),
}));

const mockGetSupabaseServerClient = jest.mocked(getSupabaseServerClient);
const mockLoadLatestPreparationSnapshot = jest.mocked(
  loadLatestPreparationSnapshot,
);

describe("GET /api/ucat/score-projection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadLatestPreparationSnapshot.mockResolvedValue(null);
  });

  it("does not run the Preparation engine during a read when no snapshot exists", async () => {
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Score projection is not available yet",
    });
  });

  it("presents the persisted canonical current estimate and trajectory without a second model", async () => {
    const preparation = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["experienced-high-performing"],
    ).result;
    preparation.trajectory = buildPreparationTrajectory({
      today: preparation.generatedAt.slice(0, 10),
      modelVersion: preparation.versions.trajectoryModel,
      currentScore: preparation.currentScore,
      forecast: {
        recentCoreSectionEquivalentsPerWeek: 3,
        recentCoreSectionEquivalentsPerWeekBySection: Object.fromEntries(
          preparation.currentScore.sections.map((section) => [
            section.sectionId,
            1,
          ]),
        ),
      },
    });
    expect(preparation.trajectory.status).toBe("available");
    if (preparation.trajectory.status !== "available") return;
    preparation.trajectory.recentCoreSectionEquivalentsPerWeek = 1;
    preparation.trajectory.recentCoreSectionEquivalentsPerWeekBySection = {
      [preparation.currentScore.sections[0]!.sectionId]: 1,
    };
    preparation.trajectory.history = [
      {
        date: "2026-01-04",
        currentEstimate: 2200,
        modelVersion: preparation.versions.trajectoryModel,
        confidence: "medium",
        uncertainty: 61,
        effectiveEvidenceWeight: 9,
        sections: Object.fromEntries(
          preparation.currentScore.sections.map((section, index) => [
            section.sectionId,
            {
              currentEstimate: [720, 730, 750][index]!,
              confidence: "medium" as const,
              uncertainty: 31 + index,
              evidenceCount: 2 + index,
            },
          ]),
        ),
      },
    ];
    preparation.currentScore.situationalJudgement = {
      sectionId: "sjt",
      sectionNumber: 4,
      currentEstimate: 710,
      evidenceCount: 3,
      confidence: "medium",
      uncertainty: 40,
      evidenceStatus: "available",
    };
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    mockLoadLatestPreparationSnapshot.mockResolvedValue({
      generatedAt: preparation.generatedAt,
      versions: preparation.versions,
      currentScore: preparation.currentScore,
      trajectory: preparation.trajectory,
    });

    const response = await GET();
    const payload = await response.json();
    const sectionTotal = payload.sections.reduce(
      (
        sum: number,
        section: { sectionNumber: number; currentEstimate: number | null },
      ) =>
        sum + (section.sectionNumber <= 3 ? (section.currentEstimate ?? 0) : 0),
      0,
    );

    expect(response.status).toBe(200);
    expect(sectionTotal).toBe(preparation.currentScore.currentEstimate);
    expect(payload.modelVersion).toBe(preparation.versions.trajectoryModel);
    expect(payload.snapshots[0]).toMatchObject({
      date: "2026-01-04",
      confidence: "medium",
      uncertainty: 61,
      effectiveEvidenceWeight: 9,
    });
    expect(payload.sections[0].history[0]).toMatchObject({
      value: 720,
      confidence: "medium",
      uncertainty: 31,
      effectiveEvidenceWeight: 2,
    });
    expect(payload.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sectionId: "sjt",
          sectionNumber: 4,
          currentEstimate: 710,
          projection: [],
        }),
      ]),
    );
    expect(payload.sections[0].paceSource).toBe("recent_activity");
    expect(payload.sections[1].paceSource).toBe("default");

    for (const point of preparation.trajectory.points) {
      const projectedTotal = payload.sections.reduce(
        (
          sum: number,
          section: {
            projection: Array<{ day: number; realistic: number }>;
          },
        ) =>
          sum +
          (section.projection.find(
            (candidate: { day: number }) => candidate.day === point.day,
          )?.realistic ?? 0),
        0,
      );
      expect(projectedTotal).toBe(point.middle);
      for (const section of payload.sections.filter(
        (candidate: { sectionNumber: number }) => candidate.sectionNumber <= 3,
      )) {
        expect(
          section.projection.find(
            (candidate: { day: number }) => candidate.day === point.day,
          )?.realistic,
        ).toBe(point.sections?.[section.sectionId]?.middle);
        expect(section.effectivePracticePerWeek).toBe(
          preparation.trajectory
            .effectiveCoreSectionEquivalentsPerWeekBySection[
            section.sectionId
          ] ?? 0,
        );
      }
    }
  });

  it("serves an existing canonical snapshot without recomputing Preparation", async () => {
    const preparation = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["experienced-high-performing"],
    ).result;
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    mockLoadLatestPreparationSnapshot.mockResolvedValue({
      generatedAt: preparation.generatedAt,
      versions: preparation.versions,
      currentScore: preparation.currentScore,
      trajectory: preparation.trajectory,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockLoadLatestPreparationSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      preparation.versions,
    );
  });

  it("serves a persisted snapshot without running freshness fan-out on GET", async () => {
    const preparation = runPreparationSandboxCase(
      PREPARATION_SANDBOX_PERSONAS["experienced-high-performing"],
    ).result;
    mockGetSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);
    mockLoadLatestPreparationSnapshot.mockResolvedValue({
      generatedAt: "2026-08-20T00:00:00.000Z",
      versions: preparation.versions,
      currentScore: preparation.currentScore,
      trajectory: preparation.trajectory,
    });
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mockLoadLatestPreparationSnapshot).toHaveBeenCalledTimes(1);
  });
});
