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
          representativeSessionCount: 2,
          representativeSectionEquivalents: 1,
          representativeAccuracy: 0.75,
          benchmarkCompleted: true,
          benchmarkPace: 0.7,
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
          representativeSessionCount: 2,
          representativeSectionEquivalents: 1,
          representativeAccuracy: 0.75,
          benchmarkCompleted: true,
          benchmarkPace: 0.7,
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

  it("allows the experience route to end learning without an accuracy hard lock", () => {
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
          targetedPracticeSessionCount: 3,
          targetedSectionEquivalents: 1.5,
          benchmarkCompleted: true,
          benchmarkPace: 0.7,
        },
      ],
    });

    expect(result.sections[0]?.mode).toBe("timing");
    expect(result.sections[0]?.learningRoute).toBe("experience");
  });

  it("does not require modules on the accuracy route", () => {
    const result = buildReadinessSnapshot({
      today: "2026-01-01",
      planningDate: "2026-08-01",
      sections: sections.slice(0, 1),
      categories: [category("reading"), category("tfct")],
      learningModules: [
        {
          id: "essential-vr",
          title: "VR foundations",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 20,
          completionPercent: 0,
          relevanceScore: 1,
        },
      ],
      signals: [
        {
          sectionId: "vr",
          currentEstimate: null,
          evidenceCount: 2,
          completedFullSets: 1,
          representativeSessionCount: 2,
          representativeSectionEquivalents: 1,
          representativeAccuracy: 0.76,
          benchmarkCompleted: true,
          benchmarkPace: 0.8,
        },
      ],
    });

    expect(result.sections[0]).toMatchObject({
      mode: "timing",
      learningRoute: "accuracy",
    });
  });

  it("keeps a graduated section in Timing after later poor evidence", () => {
    const result = buildReadinessSnapshot({
      today: "2026-02-01",
      planningDate: "2026-08-01",
      sections: sections.slice(0, 1),
      categories: [
        category("reading", { attemptedQuestionCount: 0 }),
        category("tfct", { attemptedQuestionCount: 0 }),
      ],
      signals: [
        {
          sectionId: "vr",
          currentEstimate: 500,
          evidenceCount: 10,
          completedFullSets: 1,
          representativeSessionCount: 1,
          representativeSectionEquivalents: 0.2,
          representativeAccuracy: 0.3,
          learningGraduatedAt: "2026-01-15T10:00:00.000Z",
          learningGraduationRoute: "accuracy",
          learningGraduationPolicyVersion: "preparation-policy-v2",
        },
      ],
    });

    expect(result.sections[0]).toMatchObject({
      mode: "timing",
      learningRoute: "accuracy",
      learningGraduatedAt: "2026-01-15T10:00:00.000Z",
    });
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

  it("clamps and floors natural pace to the 0.5x–1.0x prescribed ladder", () => {
    expect(paceLadderStep(0.49)).toBe(0.5);
    expect(paceLadderStep(0.99)).toBe(0.9);
    expect(paceLadderStep(1.38)).toBe(1);
  });
});
