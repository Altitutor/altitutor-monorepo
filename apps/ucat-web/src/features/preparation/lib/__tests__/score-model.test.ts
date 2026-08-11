import {
  classifyScoreEvidence,
  estimateRepresentativeScore,
  type RepresentativeScoreEvidence,
} from "../score-model";

const NOW = "2026-08-11T00:00:00.000Z";

function evidence(
  overrides: Partial<RepresentativeScoreEvidence> = {},
): RepresentativeScoreEvidence {
  return {
    evidenceSessionId: "session-1",
    source: "set",
    sectionId: "vr",
    sectionNumber: 1,
    completedAt: NOW,
    marksAwarded: 22,
    marksAvailable: 44,
    questionCount: 44,
    sectionQuestionCount: 44,
    wasTimed: true,
    prescribedPace: 1,
    breadth: "broad",
    feedbackWithheld: true,
    isStudentGenerated: false,
    isStandardised: false,
    ...overrides,
  };
}

describe("representative score model", () => {
  it("classifies only standard, broad, feedback-withheld evidence as representative", () => {
    expect(classifyScoreEvidence(evidence())).toBe("representative_full");
    expect(
      classifyScoreEvidence(
        evidence({ questionCount: 22, marksAvailable: 22 }),
      ),
    ).toBe("representative_partial");
    expect(classifyScoreEvidence(evidence({ breadth: "narrow" }))).toBe(
      "learning_only",
    );
    expect(classifyScoreEvidence(evidence({ prescribedPace: 0.8 }))).toBe(
      "learning_only",
    );
    expect(classifyScoreEvidence(evidence({ feedbackWithheld: false }))).toBe(
      "learning_only",
    );
    expect(classifyScoreEvidence(evidence({ isStudentGenerated: true }))).toBe(
      "learning_only",
    );
    expect(
      classifyScoreEvidence(
        evidence({
          breadth: "mixed",
          isStandardised: true,
          questionCount: 22,
          marksAvailable: 22,
        }),
      ),
    ).toBe("representative_partial");
  });

  it("pools marks before conversion, including DM partial marks and omissions", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({
          evidenceSessionId: "dm-1",
          sectionId: "dm",
          sectionNumber: 2,
          marksAwarded: 12.5,
          marksAvailable: 23.5,
          questionCount: 18,
          sectionQuestionCount: 35,
        }),
        evidence({
          evidenceSessionId: "dm-2",
          sectionId: "dm",
          sectionNumber: 2,
          marksAwarded: 0,
          marksAvailable: 23.5,
          questionCount: 18,
          sectionQuestionCount: 35,
        }),
      ],
    });

    expect(result.sections[0]).toMatchObject({
      sectionId: "dm",
      qualifyingEvidenceCount: 2,
      representativeMarksAwarded: 12.5,
      representativeMarksAvailable: 47,
    });
    expect(result.sections[0]!.currentEstimate).toBe(500);
  });

  it("withholds a section estimate below half an equivalent", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ questionCount: 20, marksAvailable: 20, marksAwarded: 18 }),
      ],
    });

    expect(result.sections[0]!.status).toBe("unavailable");
  });

  it("keeps an old half-equivalent estimate provisional rather than expiring it", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({
          completedAt: "2026-05-13T00:00:00.000Z",
          questionCount: 22,
          marksAvailable: 22,
          marksAwarded: 11,
        }),
      ],
    });

    expect(result.sections[0]!.status).toBe("available");
    expect(result.sections[0]!.confidence).toBe("low");
  });

  it("gives recent repeated evidence more influence than one old conflict", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({
          evidenceSessionId: "old",
          completedAt: "2026-05-13T00:00:00.000Z",
          marksAwarded: 44,
        }),
        evidence({ evidenceSessionId: "recent-1", marksAwarded: 22 }),
        evidence({ evidenceSessionId: "recent-2", marksAwarded: 22 }),
      ],
    });

    expect(result.sections[0]!.currentEstimate).toBeLessThan(650);
  });

  it("shrinks a minimum provisional sample toward the neutral prior", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ questionCount: 22, marksAwarded: 22, marksAvailable: 22 }),
      ],
    });

    expect(result.sections[0]!.currentEstimate).toBeLessThan(900);
    expect(result.sections[0]!.currentEstimate).toBeGreaterThan(700);
  });

  it("counts repeated rows from one session only once", () => {
    const single = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [evidence()],
    });
    const repeatedRow = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [evidence(), evidence()],
    });

    expect(repeatedRow.sections[0]).toEqual(single.sections[0]);
  });

  it("uses omission-inclusive available marks to qualify a completed form", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({
          questionCount: 10,
          marksAwarded: 0,
          marksAvailable: 44,
        }),
      ],
    });

    expect(result.sections[0]).toMatchObject({
      status: "available",
      representativeMarksAwarded: 0,
      representativeMarksAvailable: 44,
    });
  });

  it("maps pooled accuracy through the section-specific scoring authority", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [evidence({ marksAwarded: 22 })],
    });

    expect(result.sections[0]!.currentEstimate).toBe(570);
  });

  it("widens uncertainty when independent sessions conflict", () => {
    const consistent = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ evidenceSessionId: "a", marksAwarded: 22 }),
        evidence({ evidenceSessionId: "b", marksAwarded: 22 }),
      ],
    });
    const inconsistent = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ evidenceSessionId: "a", marksAwarded: 40 }),
        evidence({ evidenceSessionId: "b", marksAwarded: 4 }),
      ],
    });

    expect(inconsistent.sections[0]!.uncertainty).toBeGreaterThan(
      consistent.sections[0]!.uncertainty!,
    );
  });

  it("narrows uncertainty across independent consistent sessions", () => {
    const oneFull = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [evidence()],
    });
    const twoHalf = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ evidenceSessionId: "half-a", questionCount: 22, marksAvailable: 22, marksAwarded: 11 }),
        evidence({ evidenceSessionId: "half-b", questionCount: 22, marksAvailable: 22, marksAwarded: 11 }),
      ],
    });

    expect(twoHalf.sections[0]!.uncertainty).toBeLessThan(
      oneFull.sections[0]!.uncertainty!,
    );
  });

  it("moves modestly for one conflict and honestly for repeated recent evidence", () => {
    const baseline = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ evidenceSessionId: "base-a", marksAwarded: 30 }),
        evidence({ evidenceSessionId: "base-b", marksAwarded: 30 }),
        evidence({ evidenceSessionId: "base-c", marksAwarded: 30 }),
      ],
    });
    const oneConflict = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [
        evidence({ evidenceSessionId: "base-a", marksAwarded: 30 }),
        evidence({ evidenceSessionId: "base-b", marksAwarded: 30 }),
        evidence({ evidenceSessionId: "base-c", marksAwarded: 30 }),
        evidence({ evidenceSessionId: "conflict", marksAwarded: 5 }),
      ],
    });
    const repeatedPoor = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: ["a", "b", "c"].map((id) =>
        evidence({ evidenceSessionId: `poor-${id}`, marksAwarded: 5 }),
      ),
    });
    const repeatedStrong = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: ["a", "b", "c"].map((id) =>
        evidence({ evidenceSessionId: `strong-${id}`, marksAwarded: 39 }),
      ),
    });

    expect(oneConflict.sections[0]!.currentEstimate).toBeLessThan(
      baseline.sections[0]!.currentEstimate!,
    );
    expect(oneConflict.sections[0]!.currentEstimate).toBeGreaterThan(
      repeatedPoor.sections[0]!.currentEstimate!,
    );
    expect(repeatedStrong.sections[0]!.currentEstimate).toBeGreaterThan(
      baseline.sections[0]!.currentEstimate!,
    );
    expect(oneConflict.sections[0]!.uncertainty).toBeGreaterThan(
      baseline.sections[0]!.uncertainty!,
    );
  });

  it("aggregates cognitive section distributions and keeps SJT separate", () => {
    const result = estimateRepresentativeScore({
      now: NOW,
      modelVersion: "representative-score-v1",
      evidence: [1, 2, 3, 4].map((sectionNumber) =>
        evidence({
          evidenceSessionId: `section-${sectionNumber}`,
          sectionId: `section-${sectionNumber}`,
          sectionNumber,
          marksAwarded: 22,
        }),
      ),
    });

    expect(result.currentEstimate).toBe(1760);
    expect(result.situationalJudgement?.sectionNumber).toBe(4);
    expect(result.modelVersion).toBe("representative-score-v1");
  });
});
