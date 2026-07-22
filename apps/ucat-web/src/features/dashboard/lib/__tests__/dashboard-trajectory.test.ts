import {
  buildDashboardTrajectoryChartData,
  interpolateProjectionAtDay,
  resolveDashboardTrajectory,
  sectionEstimateSnapshots,
} from "@/features/dashboard/lib/dashboard-trajectory";
import type {
  ProjectionPoint,
  SectionScoreProjection,
  TotalScoreProjection,
} from "@/features/score-projection/types/score-projection";

const projection: ProjectionPoint[] = [
  {
    day: 0,
    date: "2026-07-15",
    pessimistic: 2000,
    realistic: 2000,
    optimistic: 2000,
  },
  {
    day: 120,
    date: "2026-11-12",
    pessimistic: 2200,
    realistic: 2300,
    optimistic: 2400,
  },
];

function total(confidence: TotalScoreProjection["confidence"] = "medium") {
  return {
    currentEstimate: 2000,
    confidence,
    uncertainty: 90,
    effectiveEvidenceWeight: 5,
    missingSectionNumbers: [],
    history: [],
    projection,
    horizons: [],
  } satisfies TotalScoreProjection;
}

function sections(ready = 3): SectionScoreProjection[] {
  return [1, 2, 3].map((sectionNumber) => ({
    sectionId: `section-${sectionNumber}`,
    sectionName: [
      "Verbal Reasoning",
      "Decision Making",
      "Quantitative Reasoning",
    ][sectionNumber - 1]!,
    sectionNumber,
    currentEstimate: sectionNumber <= ready ? 670 : null,
    confidence: "medium",
    uncertainty: 30,
    effectiveEvidenceWeight: 2,
    evidenceCount: 1,
    paceSource: "recent_activity",
    effectivePracticePerWeek: 100,
    history: [],
    projection: sectionNumber <= ready ? projection : [],
    horizons: [],
  }));
}

describe("dashboard trajectory", () => {
  it("interpolates a test-day estimate without pretending the model generated that exact day", () => {
    expect(interpolateProjectionAtDay(projection, 60)).toMatchObject({
      day: 60,
      date: "2026-09-13",
      pessimistic: 2100,
      realistic: 2150,
      optimistic: 2200,
    });
  });

  it("builds the baseline instead of judging a student with missing sections", () => {
    const state = resolveDashboardTrajectory({
      today: "2026-07-15",
      targetScore: 2300,
      testDate: "2026-09-13",
      total: null,
      sections: sections(1),
    });
    expect(state).toMatchObject({
      stage: "building_baseline",
      readySectionCount: 1,
      missingSectionNames: ["Decision Making", "Quantitative Reasoning"],
    });
  });

  it("does not create an exam-day forecast without an exact test date", () => {
    expect(
      resolveDashboardTrajectory({
        today: "2026-07-15",
        targetScore: 2300,
        testDate: null,
        total: total(),
        sections: sections(),
      }),
    ).toMatchObject({ stage: "no_test_date", projectedAtTest: null });
  });

  it("stops at the reliable horizon for a distant test date", () => {
    expect(
      resolveDashboardTrajectory({
        today: "2026-07-15",
        targetScore: 2400,
        testDate: "2027-07-15",
        total: total(),
        sections: sections(),
      }),
    ).toMatchObject({
      stage: "long_range",
      forecastHorizonDays: 120,
      projectedAtTest: null,
    });
  });

  it("withholds on-track language while confidence is low", () => {
    expect(
      resolveDashboardTrajectory({
        today: "2026-07-15",
        targetScore: 2100,
        testDate: "2026-09-13",
        total: total("low"),
        sections: sections(),
      }).stage,
    ).toBe("early_estimate");
  });

  it("uses the plausible range for goal status", () => {
    const input = {
      today: "2026-07-15",
      testDate: "2026-11-12",
      total: total(),
      sections: sections(),
    };
    expect(
      resolveDashboardTrajectory({ ...input, targetScore: 2150 }).stage,
    ).toBe("on_track");
    expect(
      resolveDashboardTrajectory({ ...input, targetScore: 2350 }).stage,
    ).toBe("within_reach");
    expect(
      resolveDashboardTrajectory({ ...input, targetScore: 2500 }).stage,
    ).toBe("needs_adjustment");
  });

  it("uses stored snapshots as actual history", () => {
    const data = buildDashboardTrajectoryChartData(
      total(),
      "2026-07-15",
      null,
      [
        {
          date: "2026-07-14",
          currentEstimate: 1980,
          confidence: "medium",
          uncertainty: 100,
          effectiveEvidenceWeight: 4,
          sectionEstimates: {},
        },
      ],
    );
    expect(data[0]).toMatchObject({ date: "2026-07-14", actual: 1980 });
    expect(data.find((point) => point.date === "2026-07-15")).toMatchObject({
      day: 0,
      actual: 2000,
    });
    expect(data.find((point) => point.date === "2026-11-12")).toMatchObject({
      realistic: 2300,
      range: [2200, 2400],
    });
  });

  it("keeps today fixed by limiting snapshot history to 60 days", () => {
    const data = buildDashboardTrajectoryChartData(
      total(),
      "2026-07-15",
      null,
      [
        {
          date: "2026-05-15",
          currentEstimate: 1800,
          confidence: "low",
          uncertainty: 160,
          effectiveEvidenceWeight: 2,
          sectionEstimates: {},
        },
        {
          date: "2026-05-16",
          currentEstimate: 1820,
          confidence: "low",
          uncertainty: 150,
          effectiveEvidenceWeight: 2.5,
          sectionEstimates: {},
        },
      ],
    );

    expect(data.some((point) => point.date === "2026-05-15")).toBe(false);
    expect(data.find((point) => point.date === "2026-05-16")).toMatchObject({
      day: -60,
      actual: 1820,
    });
  });

  it("averages daily snapshots into weekly actuals", () => {
    const data = buildDashboardTrajectoryChartData(
      {
        ...total(),
        projection: [
          {
            day: 0,
            date: "2026-07-22",
            pessimistic: 2000,
            realistic: 2000,
            optimistic: 2000,
          },
          {
            day: 120,
            date: "2026-11-19",
            pessimistic: 2200,
            realistic: 2300,
            optimistic: 2400,
          },
        ],
      },
      "2026-07-22",
      null,
      [
        {
          date: "2026-07-16",
          currentEstimate: 977,
          confidence: "low",
          uncertainty: 160,
          effectiveEvidenceWeight: 2,
          sectionEstimates: {},
        },
        {
          date: "2026-07-19",
          currentEstimate: 1011,
          confidence: "medium",
          uncertainty: 100,
          effectiveEvidenceWeight: 4,
          sectionEstimates: {},
        },
        {
          date: "2026-07-20",
          currentEstimate: 978,
          confidence: "high",
          uncertainty: 70,
          effectiveEvidenceWeight: 8,
          sectionEstimates: {},
        },
        {
          date: "2026-07-22",
          currentEstimate: 978,
          confidence: "high",
          uncertainty: 70,
          effectiveEvidenceWeight: 8,
          sectionEstimates: {},
        },
      ],
    );

    const actuals = data.filter((point) => point.actual != null);
    expect(
      actuals.map((point) => ({ date: point.date, actual: point.actual })),
    ).toEqual([
      // Thu–Sun week: mean(977, 1011) = 994, anchored on latest day
      { date: "2026-07-19", actual: 994 },
      // Mon–Wed week: mean(978, 978) = 978
      { date: "2026-07-22", actual: 978 },
    ]);
  });

  it("projects section estimates out of total snapshots", () => {
    const sectionSnaps = sectionEstimateSnapshots(
      [
        {
          date: "2026-07-16",
          currentEstimate: 977,
          confidence: "low",
          uncertainty: 160,
          effectiveEvidenceWeight: 2,
          sectionEstimates: { vr: 341, dm: 300, qr: 336 },
        },
        {
          date: "2026-07-17",
          currentEstimate: 987,
          confidence: "medium",
          uncertainty: 100,
          effectiveEvidenceWeight: 4,
          sectionEstimates: { vr: 342, dm: 313 },
        },
      ],
      "dm",
    );

    expect(sectionSnaps).toEqual([
      expect.objectContaining({ date: "2026-07-16", currentEstimate: 300 }),
      expect.objectContaining({ date: "2026-07-17", currentEstimate: 313 }),
    ]);
  });
});
