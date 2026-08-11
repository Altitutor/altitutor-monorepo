import {
  CURRENT_PREPARATION_VERSIONS,
  prepareStudent,
  STANDARD_PREPARATION_TIMING_PROFILE,
  type PreparationEngineInput,
} from "@/features/preparation";
import {
  generateExtraStudyTasks,
  generateStudyPlan,
} from "@/features/study-plan/lib/generator";
import {
  buildAlternativeNextStep,
  buildNextStepDrafts,
  guidanceItemKey,
} from "@/features/study-plan/lib/next-step-guidance";
import type {
  StudyPlanCategorySignal,
  StudyPlanSection,
} from "@/features/study-plan/model/types";

const sections: StudyPlanSection[] = [
  ["vr", "verbal_reasoning", "Verbal Reasoning", "VR", 1, 44, 47],
  ["dm", "decision_making", "Decision Making", "DM", 2, 35, 64],
  ["qr", "quantitative_reasoning", "Quantitative Reasoning", "QR", 3, 36, 42],
  ["sjt", "situational_judgement", "Situational Judgement", "SJ", 4, 69, 32],
].map(([id, key, name, shortName, sectionNumber, questionCount, seconds]) => ({
  id: String(id),
  key: key as StudyPlanSection["key"],
  name: String(name),
  shortName: String(shortName),
  sectionNumber: Number(sectionNumber),
  questionCount: Number(questionCount),
  timePerQuestionSeconds: Number(seconds),
}));

const categories: StudyPlanCategorySignal[] = sections.flatMap((section) => [
  {
    id: `${section.id}-category`,
    sectionId: section.id,
    name: `${section.shortName} category`,
    availableQuestionCount: 50,
    correctScore: 4,
    maxScore: 10,
    weaknessScore: 0.6,
  },
]);

function input(): PreparationEngineInput {
  return {
    clock: {
      now: "2026-01-05T00:00:00.000Z",
      today: "2026-01-05",
    },
    seed: "persona:new-student:v1",
    versions: CURRENT_PREPARATION_VERSIONS,
    timingProfile: STANDARD_PREPARATION_TIMING_PROFILE,
    goal: {
      planningDate: "2026-08-05",
      profile: {
        studyPlanEnabled: true,
        targetScore: 2200,
        testYear: 2026,
        testDate: "2026-08-05",
        availableDays: [
          { weekday: 1, maxMinutes: 60 },
          { weekday: 3, maxMinutes: 60 },
          { weekday: 6, maxMinutes: 60 },
        ],
        preferredMockWeekday: 6,
      },
    },
    content: {
      sections,
      categories,
      learningModules: [
        {
          id: "module-vr",
          title: "VR foundations",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
        },
      ],
      skillTrainers: [],
    },
    evidence: {
      sectionSignals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 600 : null,
        evidenceCount: section.sectionNumber <= 3 ? 1 : 0,
        completedFullSets: 0,
      })),
      completedMockCount: 0,
    },
    guidance: {
      dailyWarmup: false,
      incompleteReview: null,
      trainerAttemptCounts: {},
    },
  };
}

describe("prepareStudent", () => {
  it("is deterministic and returns the complete canonical result shape", () => {
    const first = prepareStudent(input());
    const second = prepareStudent(input());

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      generatedAt: "2026-01-05T00:00:00.000Z",
      seed: "persona:new-student:v1",
      versions: CURRENT_PREPARATION_VERSIONS,
      timingProfile: STANDARD_PREPARATION_TIMING_PROFILE,
      trajectory: { status: "unavailable", reason: "legacy_adapter" },
      currentScore: {
        status: "unavailable",
        currentEstimate: null,
        modelVersion: CURRENT_PREPARATION_VERSIONS.scoreModel,
      },
    });
    expect(first.assessment).toEqual(first.plan.readiness);
    expect(first.explanationTrace.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "preparation.assessment.legacy_adapter",
        "preparation.score.representative_evidence",
        "preparation.plan.legacy_adapter",
        "preparation.timing.profile",
        "timing.initial_placement",
        "preparation.guidance.legacy_adapter",
      ]),
    );
  });

  it("preserves the existing plan and guidance behavior through adapters", () => {
    const fixture = input();
    fixture.content.skillTrainers = [
      {
        id: "trainer-vr",
        key: "vr_warmup",
        name: "VR warm-up",
        sectionId: "vr",
        categoryIds: ["vr-category"],
        estimatedMinutes: 3,
      },
    ];
    const result = prepareStudent(fixture);
    const directPlan = generateStudyPlan({
      today: fixture.clock.today,
      planningDate: fixture.goal.planningDate,
      profile: fixture.goal.profile,
      sections: fixture.content.sections,
      signals: fixture.evidence.sectionSignals,
      categories: fixture.content.categories,
      learningModules: fixture.content.learningModules,
      skillTrainers: fixture.content.skillTrainers,
      completedMockCount: fixture.evidence.completedMockCount,
    });
    const directGuidance = buildNextStepDrafts({
      today: fixture.clock.today,
      planningDate: fixture.goal.planningDate,
      dailyWarmup: false,
      incompleteReview: null,
      sections: fixture.content.sections,
      signals: fixture.evidence.sectionSignals,
      categories: fixture.content.categories,
      learningModules: fixture.content.learningModules,
      skillTrainers: fixture.content.skillTrainers,
      trainerAttemptCounts: new Map(),
      completedMockCount: fixture.evidence.completedMockCount,
    });

    expect(result.plan).toEqual(directPlan);
    expect(result.immediateGuidance).toEqual(directGuidance);
  });

  it("uses the same ranked preparation objective for the plan and rolling guidance", () => {
    const fixture = input();
    fixture.content.skillTrainers = [
      {
        id: "trainer-vr",
        key: "vr_warmup",
        name: "VR warm-up",
        sectionId: "vr",
        categoryIds: ["vr-category"],
        estimatedMinutes: 3,
      },
    ];
    const result = prepareStudent(fixture);
    const firstRequired = result.activityCandidates.find(
      (candidate) => candidate.requirement === "required",
    );
    const firstPlanned = result.plan.tasks.find(
      (task) => typeof task.launchConfig.activityCandidateId === "string",
    );
    const firstGuidance = result.immediateGuidance[0];

    expect(firstRequired).toBeDefined();
    expect(firstPlanned?.launchConfig).toMatchObject({
      activityCandidateId: firstRequired?.id,
      activityObjective: firstRequired?.objective,
    });
    expect(firstGuidance?.launchConfig).toMatchObject({
      activityCandidateId: firstRequired?.id,
      objective: firstRequired?.objective,
    });
    const plannedPractice = result.plan.tasks.find(
      (task) => task.taskType === "practice",
    );
    const plannedPracticeCandidate = result.activityCandidates.find(
      (candidate) =>
        candidate.id === plannedPractice?.launchConfig.activityCandidateId,
    );
    expect(plannedPractice).toMatchObject({
      targetUnits: plannedPracticeCandidate?.dose.questionCount,
      rationale: plannedPracticeCandidate?.studentReason,
    });
    const guidanceInput = {
      today: fixture.clock.today,
      planningDate: fixture.goal.planningDate,
      targetScore: fixture.goal.profile.targetScore,
      dailyWarmup: false,
      incompleteReview: null,
      sections: fixture.content.sections,
      signals: fixture.evidence.sectionSignals,
      categories: fixture.content.categories,
      learningModules: fixture.content.learningModules,
      skillTrainers: fixture.content.skillTrainers,
      trainerAttemptCounts: new Map<string, number>(),
      completedMockCount: fixture.evidence.completedMockCount,
      activityCandidates: result.activityCandidates,
    };
    const alternative = buildAlternativeNextStep(guidanceInput, {
      excludedKeys: result.immediateGuidance.map(guidanceItemKey),
      currentTaskTypes: result.immediateGuidance.map((item) => item.taskType),
    });
    const extra = generateExtraStudyTasks({
      today: fixture.clock.today,
      planningDate: fixture.goal.planningDate,
      targetScore: fixture.goal.profile.targetScore,
      minutes: 20,
      sectionKey: null,
      sections: fixture.content.sections,
      signals: fixture.evidence.sectionSignals,
      categories: fixture.content.categories,
      skillTrainers: fixture.content.skillTrainers,
      sortOrder: 0,
      activityCandidates: result.activityCandidates,
    });

    expect(alternative?.launchConfig).toMatchObject({ optional: true });
    expect(extra.find((task) => task.taskType === "practice")?.launchConfig)
      .toMatchObject({
        optional: true,
        activityObjective: firstRequired?.objective,
      });
  });

  it("returns a structured capacity risk without mutating timing input", () => {
    const fixture = input();
    fixture.goal.profile.availableDays = [];
    const timingProfile = fixture.timingProfile;
    const result = prepareStudent(fixture);

    expect(result.capacityRisks).toHaveLength(1);
    expect(result.capacityRisks[0]?.level).toBe("warning");
    expect(result.timingProfile).toEqual(timingProfile);
    expect(result.timingProfile).not.toBe(timingProfile);
  });

  it("rejects implicit time and version dependencies", () => {
    const fixture = input();
    fixture.seed = "";
    expect(() => prepareStudent(fixture)).toThrow(
      "Preparation seed must not be empty.",
    );

    const invalidClock = input();
    invalidClock.clock.now = "not-a-time";
    expect(() => prepareStudent(invalidClock)).toThrow(
      "Preparation clock must contain a valid ISO timestamp.",
    );
  });

  it("emits permanent section graduation events through either Learning route", () => {
    const fixture = input();
    fixture.content.categories = fixture.content.categories.map((category) => ({
      ...category,
      attemptedQuestionCount: 10,
    }));
    fixture.evidence.sectionSignals = fixture.evidence.sectionSignals.map(
      (signal) =>
        signal.sectionId === "vr"
          ? {
              ...signal,
              representativeSessionCount: 2,
              representativeSectionEquivalents: 1,
              representativeAccuracy: 0.76,
              benchmarkCompleted: true,
              benchmarkPace: 0.8,
            }
          : signal.sectionId === "qr"
            ? {
                ...signal,
                targetedPracticeSessionCount: 3,
                targetedSectionEquivalents: 1.5,
                benchmarkCompleted: true,
                benchmarkPace: 0.7,
              }
            : signal,
    );
    fixture.content.learningModules.push({
      id: "module-qr",
      title: "QR foundations",
      sectionId: "qr",
      sectionNumber: 3,
      priority: "essential",
      estimatedMinutes: 15,
      completionPercent: 100,
      relevanceScore: 1,
    });

    const result = prepareStudent(fixture);

    expect(result.progressionEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionId: "vr", route: "accuracy" }),
        expect.objectContaining({ sectionId: "qr", route: "experience" }),
      ]),
    );
    expect(result.assessment.sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionId: "vr", mode: "timing" }),
        expect.objectContaining({ sectionId: "qr", mode: "timing" }),
      ]),
    );
  });

  it("never demotes a persisted graduate when later evidence is poor", () => {
    const fixture = input();
    fixture.evidence.sectionSignals = fixture.evidence.sectionSignals.map(
      (signal) =>
        signal.sectionId === "dm"
          ? {
              ...signal,
              representativeSessionCount: 1,
              representativeSectionEquivalents: 0.1,
              representativeAccuracy: 0.2,
              learningGraduatedAt: "2025-12-10T00:00:00.000Z",
              learningGraduationRoute: "accuracy" as const,
              learningGraduationPolicyVersion: fixture.versions.policy,
            }
          : signal,
    );

    const result = prepareStudent(fixture);
    const dm = result.assessment.sections.find(
      (section) => section.sectionId === "dm",
    );

    expect(dm).toMatchObject({ mode: "timing", learningRoute: "accuracy" });
    expect(
      result.progressionEvents.filter(
        (event) =>
          event.type === "learning_graduated" && event.sectionId === "dm",
      ),
    ).toHaveLength(0);
  });

  it("balances Learning by section before allocating VR and DM categories", () => {
    const fixture = input();
    fixture.goal.profile.availableDays = [0, 1, 2, 3, 4, 5, 6].map(
      (weekday) => ({
        weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        maxMinutes: 60,
      }),
    );
    fixture.content.categories = [
      ...fixture.content.categories,
      ...Array.from({ length: 8 }, (_, index) => ({
        id: `dm-extra-${index}`,
        sectionId: "dm",
        name: `DM category ${index}`,
        availableQuestionCount: 50,
        correctScore: 0,
        maxScore: 0,
        weaknessScore: 0.5,
      })),
    ];

    const result = prepareStudent(fixture);
    const practiceQuestions = new Map<string, number>();
    for (const task of result.plan.tasks.filter(
      (candidate) => candidate.taskType === "practice",
    )) {
      if (!task.sectionId) continue;
      practiceQuestions.set(
        task.sectionId,
        (practiceQuestions.get(task.sectionId) ?? 0) + (task.targetUnits ?? 0),
      );
    }

    const cognitiveExposure = sections
      .slice(0, 3)
      .map(
        (section) =>
          (practiceQuestions.get(section.id) ?? 0) / section.questionCount,
      );
    expect(
      Math.max(...cognitiveExposure) - Math.min(...cognitiveExposure),
    ).toBeLessThanOrEqual(0.3);
  });

  it("advances prescribed pace only from completed Timing evidence", () => {
    const fixture = input();
    fixture.evidence.sectionSignals = fixture.evidence.sectionSignals.map(
      (signal) => ({
        ...signal,
        learningGraduatedAt: "2026-01-01T00:00:00.000Z",
        learningGraduationRoute: "accuracy" as const,
        prescribedPace: 0.5,
        prescribedPaceSetAt: "2026-01-01T00:00:00.000Z",
        recentAccuracy: 0.76,
      }),
    );
    fixture.evidence.timingSessions = [1, 2, 3].map((index) => ({
      id: `vr-${index}`,
      sectionId: "vr",
      source: "practice" as const,
      completedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
      prescribedPace: 0.5,
      observedPace: 0.5,
      accuracy: 0.75,
      sectionEquivalents: 0.34,
      breadth: "broad" as const,
      categoryIds: ["vr-category"],
    }));

    const result = prepareStudent(fixture);
    const vr = result.assessment.sections.find(
      (section) => section.sectionId === "vr",
    );
    const vrPracticePaces = result.plan.tasks.flatMap((task) =>
      task.taskType === "practice" &&
      task.sectionId === "vr" &&
      typeof task.launchConfig.timeSpeedMultiplier === "number"
        ? [task.launchConfig.timeSpeedMultiplier]
        : [],
    );

    expect(vr).toMatchObject({
      paceMultiplier: 0.6,
      timingDecisionCode: "timing.advance_normal",
    });
    expect(result.progressionEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "timing_pace_changed",
          sectionId: "vr",
          fromPace: 0.5,
          toPace: 0.6,
          reason: "normal",
        }),
      ]),
    );
    expect(vrPracticePaces.length).toBeGreaterThan(0);
    expect(vrPracticePaces.every((pace) => pace === 0.6)).toBe(true);
  });
});
