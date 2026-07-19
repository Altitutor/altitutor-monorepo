import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";

describe("section target allocation", () => {
  it("allocates the saved total target without requiring a Study plan", () => {
    const targets = allocateSectionTargets(2200, [
      { sectionId: "vr", currentEstimate: 650 },
      { sectionId: "dm", currentEstimate: 700 },
      { sectionId: "qr", currentEstimate: 750 },
    ]);

    expect(targets).toEqual({ vr: 720, dm: 730, qr: 750 });
    expect(Object.values(targets).reduce((sum, score) => sum + score, 0)).toBe(
      2200,
    );
  });

  it("uses an even baseline before section estimates exist", () => {
    expect(
      allocateSectionTargets(2100, [
        { sectionId: "vr", currentEstimate: null },
        { sectionId: "dm", currentEstimate: null },
        { sectionId: "qr", currentEstimate: null },
      ]),
    ).toEqual({ vr: 700, dm: 700, qr: 700 });
  });
});
