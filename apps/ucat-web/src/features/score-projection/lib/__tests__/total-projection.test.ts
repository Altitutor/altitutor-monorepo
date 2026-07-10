import { deriveTotalScoreProjection } from "../total-projection";
import type { SectionScoreProjection } from "@/features/score-projection/types/score-projection";

function section(
  sectionNumber: number,
  currentEstimate: number | null,
): SectionScoreProjection {
  return {
    sectionId: `section-${sectionNumber}`,
    sectionName: `Section ${sectionNumber}`,
    sectionNumber,
    currentEstimate,
    confidence: sectionNumber === 2 ? "medium" : "high",
    uncertainty: 30,
    effectiveEvidenceWeight: 2,
    evidenceCount: 3,
    paceSource: "recent_activity",
    effectivePracticePerWeek: 100,
    projection:
      currentEstimate == null
        ? []
        : [
            {
              day: 0,
              date: "2026-07-09",
              pessimistic: currentEstimate,
              realistic: currentEstimate,
              optimistic: currentEstimate,
            },
            {
              day: 30,
              date: "2026-08-08",
              pessimistic: currentEstimate + 10,
              realistic: currentEstimate + 20,
              optimistic: currentEstimate + 30,
            },
          ],
    horizons:
      currentEstimate == null
        ? []
        : [
            {
              day: 30,
              pessimistic: currentEstimate + 10,
              realistic: currentEstimate + 20,
              optimistic: currentEstimate + 30,
            },
          ],
  };
}

describe("deriveTotalScoreProjection", () => {
  it("sums cognitive sections and excludes section 4", () => {
    const total = deriveTotalScoreProjection([
      section(1, 600),
      section(2, 650),
      section(3, 700),
      section(4, 800),
    ]);

    expect(total.currentEstimate).toBe(1950);
    expect(total.confidence).toBe("medium");
    expect(total.horizons[0]).toEqual({
      day: 30,
      pessimistic: 1980,
      realistic: 2010,
      optimistic: 2040,
    });
  });

  it("does not show a total when any cognitive section is missing evidence", () => {
    const total = deriveTotalScoreProjection([
      section(1, 600),
      section(2, null),
      section(3, 700),
    ]);

    expect(total.currentEstimate).toBeNull();
    expect(total.confidence).toBeNull();
    expect(total.projection).toEqual([]);
    expect(total.missingSectionNumbers).toEqual([2]);
  });
});
