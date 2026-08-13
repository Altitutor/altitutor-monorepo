import {
  buildAlternativeNextStep,
  buildNextStepDrafts,
  firstGuidanceTriggerKey,
  formatAttemptReviewLabel,
  guidanceItemKey,
  resolveGuidanceTrigger,
} from "@/features/study-plan/lib/next-step-guidance";
import type {
  StudyPlanCategorySignal,
  StudyPlanLearningModule,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanSkillTrainer,
} from "@/features/study-plan/model/types";

const section: StudyPlanSection = {
  id: "section-vr",
  key: "verbal_reasoning",
  name: "Verbal Reasoning",
  shortName: "VR",
  sectionNumber: 1,
  questionCount: 44,
  timePerQuestionSeconds: 42,
};

const sjtSection: StudyPlanSection = {
  id: "section-sjt",
  key: "situational_judgement",
  name: "Situational Judgement",
  shortName: "SJT",
  sectionNumber: 4,
  questionCount: 69,
  timePerQuestionSeconds: 22,
};

const signals: StudyPlanSectionSignal[] = [
  {
    sectionId: section.id,
    currentEstimate: 570,
    evidenceCount: 5,
    completedFullSets: 0,
  },
];

const category: StudyPlanCategorySignal = {
  id: "category-inference",
  sectionId: section.id,
  name: "Inference",
  availableQuestionCount: 30,
  correctScore: 0,
  maxScore: 1,
  weaknessScore: 0.595,
};

const secondaryCategory: StudyPlanCategorySignal = {
  id: "category-author-tone",
  sectionId: section.id,
  name: "Author tone",
  availableQuestionCount: 24,
  correctScore: 2,
  maxScore: 5,
  weaknessScore: 0.52,
};

const learningModule: StudyPlanLearningModule = {
  id: "module-inference",
  title: "Making careful inferences",
  sectionId: section.id,
  sectionNumber: section.sectionNumber,
  priority: "recommended",
  estimatedMinutes: 12,
  completionPercent: 0,
  relevanceScore: 0.58,
};

const trainers: StudyPlanSkillTrainer[] = [
  {
    id: "trainer-a",
    key: "trainer_a",
    name: "Trainer A",
    sectionId: section.id,
    categoryIds: [],
    estimatedMinutes: 3,
  },
  {
    id: "trainer-b",
    key: "trainer_b",
    name: "Trainer B",
    sectionId: section.id,
    categoryIds: [],
    estimatedMinutes: 3,
  },
];

function build(
  overrides: Partial<Parameters<typeof buildNextStepDrafts>[0]> = {},
) {
  return buildNextStepDrafts({
    today: "2026-01-10",
    planningDate: "2026-07-20",
    dailyWarmup: false,
    incompleteReview: null,
    sections: [section],
    signals,
    categories: [category],
    learningModules: [learningModule],
    skillTrainers: trainers,
    trainerAttemptCounts: new Map([
      ["trainer-a", 4],
      ["trainer-b", 1],
    ]),
    completedMockCount: 0,
    ...overrides,
  });
}

describe("rolling next-step guidance", () => {
  it.each([
    ["normally", 69],
    ["a_little", 35],
    ["not_at_all", null],
  ] as const)(
    "respects the %s standalone SJT preference without a plan",
    (sjtPreference, expectedQuestions) => {
      const guidance = build({
        sections: [sjtSection],
        signals: [
          {
            sectionId: sjtSection.id,
            currentEstimate: null,
            evidenceCount: 0,
            completedFullSets: 0,
          },
        ],
        categories: [],
        learningModules: [],
        skillTrainers: [],
        sjtPreference,
      });
      const sjtGuidance = guidance.find(
        (item) => item.sectionId === sjtSection.id,
      );

      if (expectedQuestions == null) {
        expect(sjtGuidance).toBeUndefined();
      } else {
        expect(sjtGuidance?.launchConfig.questionCount).toBe(expectedQuestions);
      }
    },
  );

  it("uses recent, but not historical, completed mock SJT as rolling guidance credit", () => {
    const mockSession = (completedAt: string) => ({
      id: `mock-${completedAt}`,
      sectionId: sjtSection.id,
      source: "mock" as const,
      completedAt,
      prescribedPace: 1,
      observedPace: 1,
      accuracy: 0.7,
      sectionEquivalents: 1,
      breadth: "broad" as const,
      categoryIds: [],
    });
    const input = {
      sections: [sjtSection],
      signals: [
        {
          sectionId: sjtSection.id,
          currentEstimate: null,
          evidenceCount: 0,
          completedFullSets: 0,
        },
      ],
      categories: [],
      learningModules: [],
      skillTrainers: [],
      sjtPreference: "normally" as const,
    };

    expect(
      build({
        ...input,
        completedMockCount: 1,
        timingSessions: [mockSession("2026-01-09T00:00:00.000Z")],
      }).some((item) => item.sectionId === sjtSection.id),
    ).toBe(false);
    expect(
      build({
        ...input,
        completedMockCount: 1,
        timingSessions: [mockSession("2025-11-01T00:00:00.000Z")],
      }).some((item) => item.sectionId === sjtSection.id),
    ).toBe(true);
  });

  it("treats a missing next-step collection as no guidance", () => {
    expect(firstGuidanceTriggerKey(undefined)).toBeNull();
    expect(firstGuidanceTriggerKey([])).toBeNull();
  });

  it("uses the first next-step trigger as the guidance key", () => {
    expect(
      firstGuidanceTriggerKey([{ triggerKey: "activity:practice:attempt-1" }]),
    ).toBe("activity:practice:attempt-1");
  });

  it("keeps the daily warm-up optional behind the core preparation judgement", () => {
    const steps = build({ dailyWarmup: true });

    expect(steps[0]?.taskType).not.toBe("skill_trainer");
    expect(steps.every((step) => step.skillTrainerId == null)).toBe(true);
    expect(steps).toHaveLength(2);
  });

  it("keeps an incomplete exact attempt review ahead of the daily warm-up", () => {
    const steps = build({
      dailyWarmup: true,
      incompleteReview: {
        attemptType: "set_attempt",
        attemptId: "attempt-1",
        attemptLabel: "Decision Making Set 4",
      },
    });

    expect(steps[0]).toMatchObject({
      taskType: "review",
      sourceAttemptId: "attempt-1",
      title: "Review Decision Making Set 4",
      launchPath: "/progress/set-attempts/attempt-1",
    });
  });

  it("does not rotate guidance without a newly completed activity", () => {
    expect(
      resolveGuidanceTrigger({
        today: "2026-01-10",
        currentTrigger: "activity:set:set-1:2026-01-10T09:00:00Z",
        currentCreatedAt: "2026-01-10T09:00:01Z",
        currentGeneratedOn: "2026-01-10",
        latestActivity: {
          kind: "set",
          id: "set-1",
          completedAt: "2026-01-10T09:00:00Z",
        },
      }),
    ).toBe("activity:set:set-1:2026-01-10T09:00:00Z");
  });

  it("rotates guidance after a new activity is completed", () => {
    expect(
      resolveGuidanceTrigger({
        today: "2026-01-10",
        currentTrigger: "daily:2026-01-10",
        currentCreatedAt: "2026-01-10T09:00:00Z",
        currentGeneratedOn: "2026-01-10",
        latestActivity: {
          kind: "review",
          id: "review-1",
          completedAt: "2026-01-10T09:05:00Z",
        },
      }),
    ).toBe("activity:review:review-1:2026-01-10T09:05:00Z");
  });

  it("formats practice review labels with the actual attempt details", () => {
    expect(
      formatAttemptReviewLabel({
        attemptType: "practice_session",
        sectionKey: "quantitative_reasoning",
        wasTimed: true,
      }),
    ).toBe("Quantitative Reasoning timed practice");
  });

  it("treats one observed category point as calibration rather than a confident weakness", () => {
    const steps = build({ learningModules: [] });
    const practice = steps.find((step) => step.taskType === "practice");

    expect(practice?.rationale.toLowerCase()).toContain("broader");
  });

  it("moves exam-like work ahead of short targeted practice near test day", () => {
    const steps = build({
      today: "2026-07-10",
      planningDate: "2026-07-20",
      signals: signals.map((signal) => ({
        ...signal,
        learningGraduatedAt: "2026-06-01T00:00:00.000Z",
        learningGraduationRoute: "accuracy",
      })),
    });

    expect(steps.map((step) => step.taskType)).toEqual(["mock", "practice"]);
  });

  it("marks a different-objective alternative as optional", () => {
    const input = {
      today: "2026-01-10",
      planningDate: "2026-07-20",
      dailyWarmup: false,
      incompleteReview: null,
      sections: [section],
      signals,
      categories: [category, secondaryCategory],
      learningModules: [learningModule],
      skillTrainers: trainers,
      trainerAttemptCounts: new Map([
        ["trainer-a", 4],
        ["trainer-b", 1],
      ]),
      completedMockCount: 0,
    };
    const current = buildNextStepDrafts(input);
    const alternative = buildAlternativeNextStep(input, {
      excludedKeys: current.map(guidanceItemKey),
      currentTaskTypes: current.map((item) => item.taskType),
    });

    expect(current.map((item) => item.taskType)).toEqual(["learn", "practice"]);
    expect(alternative).toMatchObject({
      taskType: "skill_trainer",
      launchConfig: { optional: true },
    });
  });

  it("uses canonical readiness when materialising a practice candidate", () => {
    const [draft] = buildNextStepDrafts({
      today: "2026-01-10",
      planningDate: "2026-07-20",
      dailyWarmup: false,
      incompleteReview: null,
      sections: [section],
      signals,
      categories: [category],
      learningModules: [],
      skillTrainers: [],
      trainerAttemptCounts: new Map(),
      completedMockCount: 0,
      readiness: {
        sections: [
          {
            sectionId: section.id,
            mode: "timing",
            paceMultiplier: 0.9,
          },
        ],
      } as never,
      activityCandidates: [
        {
          id: "canonical-vr-practice",
          kind: "targeted_practice",
          requirement: "required",
          sectionId: section.id,
          categoryIds: [category.id],
          questionTagIds: [],
          learningModuleId: null,
          skillTrainerId: null,
          sourceAttemptId: null,
          scope: "category",
          dose: { questionCount: 12, sectionEquivalents: 0.25 },
          duration: { practiceMinutes: 15, reviewMinutes: 5 },
          objective: "remediate_reliable_weakness",
          reasonCode: "activity.reliable_weakness",
          studentReason: "This is the most useful area to revisit.",
          ranking: {
            milestone: 1,
            weakness: 2,
            uncertainty: 0,
            targetGap: 0,
            tagSampling: 0,
            total: 3,
          },
        },
      ],
    });

    expect(draft?.launchConfig).toMatchObject({
      timeMode: "speed",
      timeSpeedMultiplier: 0.9,
    });
  });

  it("does not silently replace excluded required work with another objective", () => {
    const input = {
      today: "2026-07-10",
      planningDate: "2026-07-20",
      dailyWarmup: false,
      incompleteReview: null,
      sections: [section],
      signals,
      categories: [
        { ...secondaryCategory, weaknessScore: 0.8 },
        { ...category, maxScore: 5 },
      ],
      learningModules: [learningModule],
      skillTrainers: trainers,
      trainerAttemptCounts: new Map<string, number>(),
      completedMockCount: 1,
    };
    const candidatesToExclude = [
      ...buildNextStepDrafts(input),
      {
        ...buildNextStepDrafts(input)[0]!,
        taskType: "learn" as const,
        learningModuleId: learningModule.id,
        launchPath: `/learn/sections/${learningModule.sectionNumber}/${learningModule.id}`,
      },
      {
        ...buildNextStepDrafts(input)[0]!,
        taskType: "practice" as const,
        questionStemCategoryId: secondaryCategory.id,
        launchPath: "/practice",
      },
    ];
    const alternative = buildAlternativeNextStep(input, {
      excludedKeys: candidatesToExclude.map(guidanceItemKey),
      currentTaskTypes: ["section_benchmark", "mock"],
    });

    expect(alternative).toMatchObject({
      taskType: "skill_trainer",
      launchConfig: { optional: true },
    });
  });
});
