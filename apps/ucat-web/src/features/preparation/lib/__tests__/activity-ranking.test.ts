import {
  rankActivityCandidates,
  selectActivityCandidates,
  type ActivityRankingInput,
} from "@/features/preparation";
import type {
  StudyPlanReadinessSnapshot,
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
    id: "dm",
    key: "decision_making",
    name: "Decision Making",
    shortName: "DM",
    sectionNumber: 2,
    questionCount: 35,
    timePerQuestionSeconds: 64,
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

const readiness: StudyPlanReadinessSnapshot = {
  mode: "timing",
  examDateOverride: false,
  daysUntilExam: 90,
  sections: sections.map((section) => ({
    sectionId: section.id,
    sectionKey: section.key,
    mode: "timing",
    paceMultiplier: 0.8,
    observedPace: 0.75,
    learningGraduatedAt: "2026-01-01T00:00:00.000Z",
    learningRoute: "accuracy",
    nextMilestone: "Build broad evidence at 0.8× exam pace.",
    timingDecisionCode: "timing.hold_insufficient_evidence",
    calibrationDue: false,
    overspeedEligible: false,
    overspeedPace: null,
    units: [],
  })),
};

function rankingInput(): ActivityRankingInput {
  return {
    today: "2026-05-01",
    planningDate: "2026-08-01",
    targetScore: 2100,
    readiness,
    sections,
    signals: sections.map((section) => ({
      sectionId: section.id,
      currentEstimate: section.id === "vr" ? 560 : 700,
      evidenceCount: section.id === "vr" ? 1 : 6,
      completedFullSets: 1,
    })),
    categories: [
      {
        id: "vr-reading",
        sectionId: "vr",
        name: "Reading comprehension",
        availableQuestionCount: 60,
        correctScore: 8,
        maxScore: 12,
        weaknessScore: 0.8,
      },
      ...Array.from({ length: 9 }, (_, index) => ({
        id: `dm-${index}`,
        sectionId: "dm",
        name: `DM ${index}`,
        availableQuestionCount: 60,
        correctScore: 10,
        maxScore: 12,
        weaknessScore: 0.2,
      })),
    ],
    learningModules: [],
    skillTrainers: [
      {
        id: "trainer-vr",
        key: "vr_warmup",
        name: "VR warm-up",
        sectionId: "vr",
        categoryIds: ["vr-reading"],
        estimatedMinutes: 5,
      },
    ],
    trainerAttemptCounts: new Map(),
    incompleteReview: null,
    completedMockCount: 0,
  };
}

describe("canonical activity ranking", () => {
  it("does not assign a sectionless learning module to an arbitrary section", () => {
    const input = rankingInput();
    input.readiness = {
      ...readiness,
      mode: "learning",
      sections: readiness.sections.map((section) => ({
        ...section,
        mode: "learning",
      })),
    };
    input.learningModules = [
      {
        id: "sectionless-module",
        title: "General advice",
        sectionId: null,
        sectionNumber: null,
        priority: "essential",
        estimatedMinutes: 10,
        completionPercent: 0,
        relevanceScore: 1,
      },
      {
        id: "vr-module",
        title: "VR foundations",
        sectionId: "vr",
        sectionNumber: 1,
        priority: "essential",
        estimatedMinutes: 10,
        completionPercent: 0,
        relevanceScore: 1,
      },
    ];

    const instructionCandidates = rankActivityCandidates(input).filter(
      (candidate) => candidate.kind === "instruction",
    );

    expect(instructionCandidates).toEqual([
      expect.objectContaining({
        id: "instruction:vr-module",
        learningModuleId: "vr-module",
        sectionId: "vr",
      }),
    ]);
  });

  it("returns complete candidate provenance and ranks milestones by section rather than taxonomy count", () => {
    const candidates = rankActivityCandidates(rankingInput());
    const firstRequired = candidates.find(
      (candidate) => candidate.requirement === "required",
    );

    expect(firstRequired).toMatchObject({
      sectionId: "vr",
      kind: "targeted_practice",
      objective: "remediate_reliable_weakness",
      reasonCode: "activity.reliable_weakness",
      scope: "category",
      dose: {
        questionCount: expect.any(Number),
        sectionEquivalents: expect.any(Number),
      },
      duration: {
        practiceMinutes: expect.any(Number),
        reviewMinutes: expect.any(Number),
      },
      ranking: {
        milestone: expect.any(Number),
        weakness: expect.any(Number),
        uncertainty: expect.any(Number),
        targetGap: 14,
        tagSampling: 0,
        total: expect.any(Number),
      },
    });
    expect(
      candidates.filter((candidate) => candidate.kind === "optional_warmup"),
    ).toHaveLength(1);
  });

  it("uses tags only as a capped sampling bias after inventory and independent evidence gates", () => {
    const insufficient = rankingInput();
    insufficient.tagSignals = [
      {
        id: "vr-dense-text",
        sectionId: "vr",
        categoryId: "vr-reading",
        availableQuestionCount: 30,
        independentSessionCount: 1,
        weaknessScore: 0.9,
      },
    ];
    const eligible = rankingInput();
    eligible.tagSignals = [
      {
        ...insufficient.tagSignals[0]!,
        independentSessionCount: 2,
      },
    ];

    expect(rankActivityCandidates(insufficient)[0]?.questionTagIds).toEqual([]);
    expect(rankActivityCandidates(eligible)[0]).toMatchObject({
      questionTagIds: ["vr-dense-text"],
      ranking: { tagSampling: 9 },
    });
  });

  it("uses the same preparation judgement for plan, guidance, alternatives and extra work", () => {
    const candidates = rankActivityCandidates(rankingInput());
    const planned = selectActivityCandidates(candidates, { experience: "plan" });
    const guidance = selectActivityCandidates(candidates, {
      experience: "guidance",
    });
    const alternative = selectActivityCandidates(candidates, {
      experience: "alternative",
      currentCandidateIds: [guidance[0]!.id],
    });
    const extra = selectActivityCandidates(candidates, {
      experience: "extra",
      requiredWorkComplete: true,
    });

    expect(planned[0]?.objective).toBe("remediate_reliable_weakness");
    expect(guidance[0]?.objective).toBe(planned[0]?.objective);
    expect(alternative[0]).toMatchObject({
      objective: planned[0]?.objective,
      requirement: "required",
    });
    expect(extra[0]).toMatchObject({
      kind: "optional_extension",
      objective: planned[0]?.objective,
      requirement: "optional",
    });
    expect(
      selectActivityCandidates(candidates, {
        experience: "extra",
        requiredWorkComplete: false,
      }),
    ).toEqual([]);
  });
});
