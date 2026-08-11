import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";

describe("section target allocation", () => {
  it("allocates the saved total target without requiring a Study plan", () => {
    const targets = allocateSectionTargets({
      totalTarget: 2200,
      sections: [
        { sectionId: "vr", currentEstimate: 650, confidence: "high" },
        { sectionId: "dm", currentEstimate: 700, confidence: "high" },
        { sectionId: "qr", currentEstimate: 750, confidence: "high" },
      ],
      previousTargets: { vr: 720, dm: 730, qr: 750 },
      previousTargetsSetAt: "2026-01-01T00:00:00.000Z",
      now: "2026-01-09T00:00:00.000Z",
    });

    expect(targets).toEqual({ vr: 720, dm: 730, qr: 750 });
    expect(Object.values(targets).reduce((sum, score) => sum + score, 0)).toBe(
      2200,
    );
  });

  it("uses an even baseline before section estimates exist", () => {
    expect(
      allocateSectionTargets({
        totalTarget: 2100,
        sections: [
          { sectionId: "vr", currentEstimate: null },
          { sectionId: "dm", currentEstimate: null },
          { sectionId: "qr", currentEstimate: null },
        ],
      }),
    ).toEqual({ vr: 700, dm: 700, qr: 700 });
  });
});
