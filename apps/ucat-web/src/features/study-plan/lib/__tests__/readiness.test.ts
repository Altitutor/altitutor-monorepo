import {
  buildReadinessSnapshot,
  paceLadderStep,
} from "@/features/study-plan/lib/readiness";
import type {
  StudyPlanCategorySignal,
  StudyPlanSection,
} from "@/features/study-plan/model/types";

const sections: StudyPlanSection[] = [
  {
    id: "vr",
    key: "verbal_reasoning",
    name: "Verbal Reasoning",
    shortName: "VR",
    sectionNumber: 1,
    questionCount: 44,
    timePerQuestionSeconds: 47,
  },
  {
    id: "qr",
    key: "quantitative_reasoning",
    name: "Quantitative Reasoning",
    shortName: "QR",
    sectionNumber: 3,
    questionCount: 36,
    timePerQuestionSeconds: 42,
  },
];

function category(
  id: string,
  overrides: Partial<StudyPlanCategorySignal> = {},
): StudyPlanCategorySignal {
  return {
    id,
    sectionId: "vr",
    name: id,
    availableQuestionCount: 40,
    correctScore: 14,
    maxScore: 20,
    weaknessScore: 0.3,
    attemptedQuestionCount: 20,
    completedPracticeSessions: 2,
    qualifyingPracticeSessions: 1,
    largestPracticeSessionQuestionCount: 10,
    recentAccuracy: 0.7,
    observedPace: 0.73,
    ...overrides,
  };
}

describe("study-plan readiness", () => {
  it("uses category readiness for VR but section readiness for QR", () => {
    const result = buildReadinessSnapshot({
      today: "2026-01-01",
      planningDate: "2026-08-01",
      sections,
      categories: [category("reading"), category("tfct")],
      signals: [
        {
          sectionId: "vr",
          currentEstimate: 600,
          evidenceCount: 4,
          completedFullSets: 0,
          observedPace: 0.73,
        },
        {
          sectionId: "qr",
          currentEstimate: 600,
          evidenceCount: 4,
          completedFullSets: 0,
          attemptedQuestionCount: 20,
          completedPracticeSessions: 2,
          qualifyingPracticeSessions: 1,
          largestPracticeSessionQuestionCount: 12,
          recentAccuracy: 0.7,
        },
      ],
    });

    expect(result.sections[0]).toMatchObject({
      mode: "timing",
      paceMultiplier: 0.7,
    });
    expect(result.sections[0]?.units).toHaveLength(2);
    expect(result.sections[1]?.units).toEqual([
      expect.objectContaining({ scope: "section", learningComplete: true }),
    ]);
  });

  it("allows exposure to end learning without an accuracy hard lock", () => {
    const result = buildReadinessSnapshot({
      today: "2026-01-01",
      planningDate: "2026-08-01",
      sections: sections.slice(0, 1),
      categories: [
        category("reading", {
          attemptedQuestionCount: 40,
          completedPracticeSessions: 3,
          qualifyingPracticeSessions: 2,
          largestPracticeSessionQuestionCount: 15,
          recentAccuracy: 0.42,
        }),
        category("tfct", {
          attemptedQuestionCount: 40,
          completedPracticeSessions: 3,
          qualifyingPracticeSessions: 2,
          largestPracticeSessionQuestionCount: 15,
          recentAccuracy: 0.5,
        }),
      ],
      signals: [
        {
          sectionId: "vr",
          currentEstimate: 500,
          evidenceCount: 6,
          completedFullSets: 0,
        },
      ],
    });

    expect(result.sections[0]?.mode).toBe("timing");
    expect(result.sections[0]?.units[0]?.readinessRoute).toBe("exposure");
  });

  it("uses exam proximity as an override and starts pace at 0.5x", () => {
    const result = buildReadinessSnapshot({
      today: "2026-06-15",
      planningDate: "2026-08-01",
      sections,
      categories: [category("reading", { maxScore: 0 })],
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
    });

    expect(result.mode).toBe("exam");
    expect(result.examDateOverride).toBe(true);
    expect(result.sections.every((section) => section.mode === "exam")).toBe(
      true,
    );
    expect(result.sections[0]?.paceMultiplier).toBe(0.5);
  });

  it("clamps and floors natural pace to the 0.5x–1.3x ladder", () => {
    expect(paceLadderStep(0.49)).toBe(0.5);
    expect(paceLadderStep(0.99)).toBe(0.9);
    expect(paceLadderStep(1.38)).toBe(1.3);
  });
});
