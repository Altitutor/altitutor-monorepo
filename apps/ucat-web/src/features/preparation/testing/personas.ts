import type { PreparationEngineInput } from "@/features/preparation/model/types";

export type PreparationPersona = {
  key: string;
  label: string;
  description: string;
  apply: (base: PreparationEngineInput) => PreparationEngineInput;
};

export const ACCURATE_SLOW_PREPARATION_PERSONA: PreparationPersona = {
  key: "accurate-slow",
  label: "Accurate but slow",
  description:
    "Strong untimed accuracy with a weak visible VR estimate because prescribed-pace work is not yet complete.",
  apply(base) {
    const cognitiveSections = base.content.sections.filter(
      (section) => section.sectionNumber <= 3,
    );
    return {
      ...base,
      seed: "persona:accurate-slow:v1",
      content: {
        ...base.content,
        learningModules: base.content.learningModules.map((module) => ({
          ...module,
          completionPercent: 100,
        })),
        categories: base.content.categories.map((category) =>
          category.sectionId === "vr"
            ? { ...category, attemptedQuestionCount: 10 }
            : category,
        ),
      },
      evidence: {
        ...base.evidence,
        scoreEvidence: cognitiveSections.map((section) => ({
          evidenceSessionId: `accurate-slow-${section.id}`,
          source: "mock" as const,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          completedAt: base.clock.now,
          marksAwarded:
            section.questionCount * (section.id === "vr" ? 0.35 : 0.6),
          marksAvailable: section.questionCount,
          questionCount: section.questionCount,
          sectionQuestionCount: section.questionCount,
          wasTimed: true,
          prescribedPace: 1,
          breadth: "broad" as const,
          feedbackWithheld: true,
          isStudentGenerated: false,
          isStandardised: true,
        })),
        sectionSignals: base.evidence.sectionSignals.map((signal) =>
          signal.sectionId === "vr"
            ? {
                ...signal,
                currentEstimate: 500,
                scoreConfidence: "medium" as const,
                representativeSessionCount: 3,
                representativeSectionEquivalents: 1.5,
                representativeAccuracy: 0.82,
                benchmarkCompleted: true,
                benchmarkAccuracy: 0.82,
                benchmarkPace: 0.65,
                observedPace: 0.65,
              }
            : signal,
        ),
      },
    };
  },
};
