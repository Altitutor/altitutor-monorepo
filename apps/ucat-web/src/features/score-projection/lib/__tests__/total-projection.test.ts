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
    history:
      currentEstimate == null
        ? []
        : [
            {
              date: "2026-07-02",
              value: currentEstimate - 10,
              confidence: "medium",
              uncertainty: 35,
              effectiveEvidenceWeight: 1.5,
            },
            {
              date: "2026-07-09",
              value: currentEstimate,
              confidence: sectionNumber === 2 ? "medium" : "high",
              uncertainty: 30,
              effectiveEvidenceWeight: 2,
            },
          ],
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
    expect(total.history.at(-1)).toMatchObject({
      date: "2026-07-09",
      value: 1950,
      confidence: "medium",
    });
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
    expect(total.history).toEqual([]);
    expect(total.projection).toEqual([]);
    expect(total.missingSectionNumbers).toEqual([2]);
  });

  it("carries section history forward so staggered weekly starts still form a total line", () => {
    const early = {
      ...section(1, 610),
      history: [
        {
          date: "2026-07-02",
          value: 590,
          confidence: "high" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
        {
          date: "2026-07-09",
          value: 600,
          confidence: "high" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
        {
          date: "2026-07-16",
          value: 610,
          confidence: "high" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
      ],
    };
    const mid = {
      ...section(2, 660),
      history: [
        {
          date: "2026-07-02",
          value: 640,
          confidence: "medium" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
        {
          date: "2026-07-09",
          value: 650,
          confidence: "medium" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
        {
          date: "2026-07-16",
          value: 660,
          confidence: "medium" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
      ],
    };
    const late = {
      ...section(3, 700),
      history: [
        {
          date: "2026-07-09",
          value: 690,
          confidence: "high" as const,
          uncertainty: 30,
          effectiveEvidenceWeight: 2,
        },
      ],
    };

    const total = deriveTotalScoreProjection([early, mid, late]);

    // Exact-date intersection would only keep 07-09. Carry-forward also emits
    // 07-16 using the late section's last known estimate.
    expect(total.history).toEqual([
      expect.objectContaining({ date: "2026-07-09", value: 1940 }),
      expect.objectContaining({ date: "2026-07-16", value: 1960 }),
    ]);
  });
});
