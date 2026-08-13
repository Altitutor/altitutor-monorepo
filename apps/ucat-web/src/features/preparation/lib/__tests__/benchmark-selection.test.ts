import {
  selectBenchmarkMock,
  selectBenchmarkSet,
} from "@/features/preparation/lib/benchmark-selection";

describe("benchmark asset selection", () => {
  it("matches section and form before choosing nearest authored pace", () => {
    const result = selectBenchmarkSet({
      sectionId: "vr",
      sectionQuestionCount: 44,
      requestedQuestionCount: 44,
      requestedPace: 0.5,
      usedSetIds: new Set(),
      sets: [
        {
          id: "wrong-section",
          name: "DM set",
          sectionId: "dm",
          questionCount: 35,
          pace: 0.5,
          completedAttempts: [],
        },
        {
          id: "partial",
          name: "VR partial",
          sectionId: "vr",
          questionCount: 22,
          pace: 0.5,
          completedAttempts: [],
        },
        {
          id: "nearer-attempted",
          name: "VR 0.6",
          sectionId: "vr",
          questionCount: 44,
          pace: 0.6,
          completedAttempts: ["2026-08-01T00:00:00.000Z"],
        },
        {
          id: "farther-unattempted",
          name: "VR 0.8",
          sectionId: "vr",
          questionCount: 44,
          pace: 0.8,
          completedAttempts: [],
        },
      ],
    });

    expect(result).toMatchObject({
      status: "selected",
      repeated: true,
      asset: { id: "nearer-attempted", pace: 0.6 },
    });
  });

  it("uses a labelled least-recent repeat only after the plan exhausts eligible sets", () => {
    const result = selectBenchmarkSet({
      sectionId: "vr",
      sectionQuestionCount: 44,
      requestedQuestionCount: 44,
      requestedPace: 1,
      usedSetIds: new Set(["older", "newer"]),
      sets: [
        {
          id: "newer",
          name: "Newer",
          sectionId: "vr",
          questionCount: 44,
          pace: 1,
          completedAttempts: ["2026-08-10T00:00:00.000Z"],
        },
        {
          id: "older",
          name: "Older",
          sectionId: "vr",
          questionCount: 44,
          pace: 1,
          completedAttempts: ["2026-07-01T00:00:00.000Z"],
        },
      ],
    });

    expect(result).toMatchObject({
      status: "selected",
      repeated: true,
      asset: { id: "older" },
    });
  });

  it("reports a hard gap rather than substituting generated practice", () => {
    expect(
      selectBenchmarkSet({
        sectionId: "qr",
        sectionQuestionCount: 36,
        requestedQuestionCount: 36,
        requestedPace: 0.8,
        usedSetIds: new Set(),
        sets: [],
      }),
    ).toEqual({ status: "gap", reason: "no_eligible_set" });
  });

  it("prefers an unattempted mock then the least-recent repeat", () => {
    const mocks = [
      {
        id: "mock-old",
        name: "Mock old",
        completedAttempts: ["2026-06-01T00:00:00.000Z"],
      },
      { id: "mock-new", name: "Mock new", completedAttempts: [] },
    ];
    expect(selectBenchmarkMock({ mocks, usedMockIds: new Set() })).toMatchObject({
      status: "selected",
      asset: { id: "mock-new" },
      repeated: false,
    });
    expect(
      selectBenchmarkMock({
        mocks: mocks.slice(0, 1),
        usedMockIds: new Set(["mock-old"]),
      }),
    ).toMatchObject({
      status: "selected",
      asset: { id: "mock-old" },
      repeated: true,
    });
  });
});
