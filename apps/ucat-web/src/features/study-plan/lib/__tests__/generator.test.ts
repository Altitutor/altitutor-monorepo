import {
  generateExtraStudyTasks,
  generateStudyPlan,
  reviewTask,
} from "@/features/study-plan/lib/generator";
import type {
  StudyPlanCategorySignal,
  StudyPlanProfileInput,
  StudyPlanSection,
  StudyPlanSkillTrainer,
} from "@/features/study-plan/model/types";

const sections: StudyPlanSection[] = [
  ["vr", "verbal_reasoning", "Verbal Reasoning", "VR", 1, 44, 47],
  ["dm", "decision_making", "Decision Making", "DM", 2, 35, 64],
  ["qr", "quantitative_reasoning", "Quantitative Reasoning", "QR", 3, 36, 42],
  ["sjt", "situational_judgement", "Situational Judgement", "SJ", 4, 69, 32],
].map(
  ([
    id,
    key,
    name,
    shortName,
    sectionNumber,
    questionCount,
    timePerQuestionSeconds,
  ]) => ({
    id: String(id),
    key: key as StudyPlanSection["key"],
    name: String(name),
    shortName: String(shortName),
    sectionNumber: Number(sectionNumber),
    questionCount: Number(questionCount),
    timePerQuestionSeconds: Number(timePerQuestionSeconds),
  }),
);

const profile: StudyPlanProfileInput = {
  studyPlanEnabled: true,
  targetScore: 2100,
  testYear: 2026,
  testDate: "2026-08-05",
  availableDays: [{ weekday: 1 }, { weekday: 3 }, { weekday: 6 }],
  preferredMockWeekday: 6,
};

const categories: StudyPlanCategorySignal[] = sections.flatMap(
  (section, index) => [
    {
      id: `${section.id}-weak`,
      sectionId: section.id,
      name: `${section.shortName} weak category`,
      availableQuestionCount: 100,
      correctScore: 2,
      maxScore: 10,
      weaknessScore: 0.8 - index * 0.05,
    },
    {
      id: `${section.id}-strong`,
      sectionId: section.id,
      name: `${section.shortName} strong category`,
      availableQuestionCount: 100,
      correctScore: 8,
      maxScore: 10,
      weaknessScore: 0.2,
    },
  ],
);

const skillTrainers: StudyPlanSkillTrainer[] = sections
  .slice(0, 3)
  .map((section) => ({
    id: `${section.id}-trainer`,
    key: `${section.key}_warmup`,
    name: `${section.shortName} warm-up`,
    sectionId: section.id,
    categoryIds: [`${section.id}-weak`],
    estimatedMinutes: 1,
  }));

const benchmarkSets = sections
  .filter((section) => section.sectionNumber <= 3)
  .flatMap((section) =>
    [0.5, 0.6, 0.7, 0.8, 0.9, 1].map((pace) => ({
      id: `${section.id}-set-${pace}`,
      name: `${section.shortName} ${pace.toFixed(1)}× set`,
      sectionId: section.id,
      questionCount: section.questionCount,
      pace,
      completedAttempts: [],
    })),
  );
const benchmarkMocks = Array.from({ length: 12 }, (_, index) => ({
  id: `mock-${index + 1}`,
  name: `UCAT mock ${index + 1}`,
  completedAttempts: [],
}));
const contentInputs = {
  categories,
  skillTrainers,
  benchmarkSets,
  benchmarkMocks,
};
const timingCategories = categories.map((category) => ({
  ...category,
  attemptedQuestionCount: 20,
  completedPracticeSessions: 2,
  qualifyingPracticeSessions: 1,
  largestPracticeSessionQuestionCount: 10,
  recentAccuracy: 0.7,
}));

describe("generateStudyPlan", () => {
  it("normalises scheduled core dose by the actual shortened horizon", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-01-11",
      profile: {
        ...profile,
        testDate: "2026-01-11",
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: 600,
        evidenceCount: 2,
        completedFullSets: 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });
    const questionCounts = new Map(
      sections
        .filter((section) => section.sectionNumber <= 3)
        .map((section) => [section.id, section.questionCount]),
    );
    const scheduledDose = result.tasks.reduce((sum, task) => {
      if (task.taskType === "mock") return sum + 3;
      if (
        (task.taskType !== "practice" &&
          task.taskType !== "section_benchmark") ||
        !task.sectionId ||
        !task.targetUnits
      ) {
        return sum;
      }
      const sectionQuestionCount = questionCounts.get(task.sectionId);
      return sectionQuestionCount
        ? sum + task.targetUnits / sectionQuestionCount
        : sum;
    }, 0);

    expect(result.endsOn).toBe("2026-01-11");
    expect(result.coreSectionEquivalentsPerWeek).toBeCloseTo(scheduledDose, 1);
    expect(
      Object.values(result.coreSectionEquivalentsPerWeekBySection).reduce(
        (sum, dose) => sum + dose,
        0,
      ),
    ).toBeCloseTo(result.coreSectionEquivalentsPerWeek, 2);
  });

  it("starts with short learning loops inside a rolling horizon", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        {
          id: "lesson-1",
          title: "How to approach VR passages",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 20,
          completionPercent: 0,
          relevanceScore: 1,
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(result.tasks[0]).toMatchObject({
      taskType: "learn",
      learningModuleId: "lesson-1",
    });
    const firstPractice = result.tasks.find(
      (task) => task.taskType === "practice",
    );
    expect(firstPractice?.launchConfig).toMatchObject({
      timeMode: "off",
      reviewTiming: "afterEachStem",
    });
    expect(result.tasks.some((task) => task.taskType === "mock")).toBe(false);
    expect(firstPractice?.questionStemCategoryId).toBeNull();
    expect(result.tasks.some((task) => task.taskType === "skill_trainer")).toBe(
      false,
    );
    expect(result.tasks.some((task) => task.taskType === "review")).toBe(true);
    expect(result.endsOn).toBe("2026-01-25");
    const practiceByDate = new Map<string, number>();
    for (const task of result.tasks.filter(
      (candidate) => candidate.taskType === "practice",
    )) {
      practiceByDate.set(
        task.scheduledDate,
        (practiceByDate.get(task.scheduledDate) ?? 0) + 1,
      );
    }
    expect(Math.max(...practiceByDate.values())).toBeLessThanOrEqual(2);
  });

  it("mixes practice into Learning when many unfinished lessons could fill the horizon", () => {
    const learningModules = sections
      .filter((section) => section.sectionNumber <= 3)
      .flatMap((section) =>
        Array.from({ length: 6 }, (_, index) => ({
          id: `${section.id}-lesson-${index}`,
          title: `${section.shortName} lesson ${index + 1}`,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          priority: "essential" as const,
          estimatedMinutes: 30,
          completionPercent: 0,
          relevanceScore: 0.5,
        })),
      );
    const result = generateStudyPlan({
      today: "2026-08-12",
      planningDate: "2027-07-28",
      profile: {
        ...profile,
        testDate: "2027-07-28",
        availableDays: [
          { weekday: 1 },
          { weekday: 2 },
          { weekday: 4 },
          { weekday: 5 },
          { weekday: 6 },
        ],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 340 : null,
        evidenceCount: section.sectionNumber <= 3 ? 6 : 0,
        completedFullSets: section.sectionNumber <= 3 ? 4 : 0,
      })),
      learningModules,
      ...contentInputs,
      completedMockCount: 9,
    });

    const coreTasks = result.tasks.filter(
      (task) => task.taskType === "learn" || task.taskType === "practice",
    );
    expect(coreTasks.some((task) => task.taskType === "learn")).toBe(true);
    expect(coreTasks.some((task) => task.taskType === "practice")).toBe(true);
    expect(
      Math.max(
        ...result.tasks
          .filter((task) => task.taskType === "learn")
          .map((task) => task.estimatedMinutes),
      ),
    ).toBe(20);
    const tasksByDate = Map.groupBy(result.tasks, (task) => task.scheduledDate);
    for (const learningTask of result.tasks.filter(
      (task) => task.taskType === "learn",
    )) {
      const tasks = tasksByDate.get(learningTask.scheduledDate) ?? [];
      expect(
        tasks.some(
          (task) =>
            task.taskType === "practice" &&
            task.sectionId === learningTask.sectionId,
        ),
      ).toBe(true);
      expect(
        tasks.some(
          (task) =>
            task.taskType === "review" &&
            task.sectionId === learningTask.sectionId,
        ),
      ).toBe(true);
    }
    expect(result.capacityRisk.message).toBeNull();
  });

  it("uses every ordinary Learning day for an ordered loop, then starts section diagnostics", () => {
    const learningModules = sections
      .filter((section) => section.sectionNumber <= 3)
      .flatMap((section) =>
        Array.from({ length: 4 }, (_, index) => ({
          id: `${section.id}-essential-${index + 1}`,
          title: `${section.shortName} essential ${index + 1}`,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          priority: "essential" as const,
          authoredOrder: index + 1,
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
        })),
      );
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules,
      ...contentInputs,
      completedMockCount: 0,
    });
    const tasksByDate = Map.groupBy(result.tasks, (task) => task.scheduledDate);
    const learningDays = [...tasksByDate]
      .filter(([, tasks]) => tasks.some((task) => task.taskType === "learn"))
      .map(([date, tasks]) => ({
        date,
        modules: tasks
          .filter((task) => task.taskType === "learn")
          .map((task) => task.learningModuleId),
        linkedQuestionCounts: tasks
          .filter(
            (task) =>
              task.taskType === "practice" &&
              task.launchConfig.linkedLearningPractice === true,
          )
          .map((task) => task.targetUnits),
      }));

    expect(learningDays.slice(0, 3)).toEqual([
      {
        date: "2026-01-05",
        modules: ["vr-essential-1"],
        linkedQuestionCounts: [27],
      },
      {
        date: "2026-01-07",
        modules: ["dm-essential-1"],
        linkedQuestionCounts: [21],
      },
      {
        date: "2026-01-10",
        modules: ["qr-essential-1"],
        linkedQuestionCounts: [22],
      },
    ]);
    const firstBenchmark = result.tasks.find(
      (task) => task.taskType === "section_benchmark",
    );
    expect((firstBenchmark?.scheduledDate ?? "") > "2026-01-10").toBe(true);
    expect(
      result.tasks
        .filter((task) => task.taskType === "section_benchmark")
        .every((task) => task.questionSetId != null),
    ).toBe(true);
  });

  it("allows multiple ordered Learning loops when selected days create capacity pressure", () => {
    const learningModules = sections
      .filter((section) => section.sectionNumber <= 3)
      .flatMap((section) =>
        Array.from({ length: 4 }, (_, index) => ({
          id: `${section.id}-pressure-${index + 1}`,
          title: `${section.shortName} pressure module ${index + 1}`,
          sectionId: section.id,
          sectionNumber: section.sectionNumber,
          priority: "essential" as const,
          authoredOrder: index + 1,
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
        })),
      );
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [{ weekday: 1 }],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules,
      ...contentInputs,
      completedMockCount: 0,
    });
    const firstDayLearningTasks = result.tasks.filter(
      (task) =>
        task.scheduledDate === "2026-01-05" && task.taskType === "learn",
    );

    expect(firstDayLearningTasks).toHaveLength(2);
    expect(firstDayLearningTasks.map((task) => task.sectionId)).toEqual([
      "vr",
      "dm",
    ]);
    expect(result.capacityRisk.level).toBe("warning");
  });

  it("continues from essential into recommended instruction while Learning", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        {
          id: "vr-recommended",
          title: "VR next method",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "recommended",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
        },
        {
          id: "vr-essential",
          title: "VR foundations",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 0.5,
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks
        .filter((task) => task.taskType === "learn")
        .map((task) => task.learningModuleId),
    ).toEqual(["vr-essential", "vr-recommended"]);
  });

  it("prescribes authored module-linked Learning loops without prioritising partial progress", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        {
          id: "vr-essential-later",
          title: "Later essential",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 80,
          relevanceScore: 1,
          authoredOrder: 2,
          categoryIds: ["vr-strong"],
          questionTagIds: ["tag-later"],
        },
        {
          id: "vr-recommended-first-index",
          title: "Recommended module",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "recommended",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
          authoredOrder: 0,
          categoryIds: ["vr-strong"],
          questionTagIds: ["tag-recommended"],
        },
        {
          id: "vr-essential-first",
          title: "First essential",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 0,
          authoredOrder: 1,
          categoryIds: ["vr-weak", "vr-strong"],
          questionTagIds: ["tag-a", "tag-b"],
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    const learningTasks = result.tasks.filter(
      (task) => task.taskType === "learn",
    );
    expect(learningTasks.map((task) => task.learningModuleId)).toEqual([
      "vr-essential-first",
      "vr-essential-later",
      "vr-recommended-first-index",
    ]);

    for (const learningTask of learningTasks) {
      const tasksOnDay = result.tasks
        .filter((task) => task.scheduledDate === learningTask.scheduledDate)
        .sort((left, right) => left.sortOrder - right.sortOrder);
      const learningIndex = tasksOnDay.findIndex(
        (task) => task.learningModuleId === learningTask.learningModuleId,
      );
      expect(tasksOnDay[learningIndex + 1]).toMatchObject({
        taskType: "practice",
        sectionId: learningTask.sectionId,
      });
      expect(tasksOnDay[learningIndex + 2]).toMatchObject({
        taskType: "review",
        sectionId: learningTask.sectionId,
      });
    }

    const firstLinkedPractice = result.tasks.find(
      (task) =>
        task.taskType === "practice" &&
        task.launchConfig.learningModuleId === "vr-essential-first",
    );
    expect(firstLinkedPractice?.launchConfig).toMatchObject({
      categoryIds: ["vr-weak", "vr-strong"],
      questionTagIds: ["tag-a", "tag-b"],
      linkedLearningPractice: true,
      reviewTiming: "afterEachStem",
    });
  });

  it("rotates Learning modules by section and never auto-prescribes optional modules", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        ...sections.slice(0, 3).flatMap((section) =>
          [1, 2].map((authoredOrder) => ({
            id: `${section.id}-essential-${authoredOrder}`,
            title: `${section.shortName} essential ${authoredOrder}`,
            sectionId: section.id,
            sectionNumber: section.sectionNumber,
            priority: "essential" as const,
            estimatedMinutes: 15,
            completionPercent: 0,
            relevanceScore: section.id === "vr" ? 1 : 0,
            authoredOrder,
          })),
        ),
        {
          id: "vr-optional",
          title: "VR optional",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "optional",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 1,
          authoredOrder: 0,
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    const learningTasks = result.tasks.filter(
      (task) => task.taskType === "learn",
    );
    expect(learningTasks.slice(0, 3).map((task) => task.sectionId)).toEqual([
      "vr",
      "dm",
      "qr",
    ]);
    expect(
      learningTasks.some((task) => task.learningModuleId === "vr-optional"),
    ).toBe(false);
  });

  it("continues Learning rotation from the least recently served section", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: sections.slice(0, 3).map((section) => ({
        id: `${section.id}-essential`,
        title: `${section.shortName} essential`,
        sectionId: section.id,
        sectionNumber: section.sectionNumber,
        priority: "essential" as const,
        estimatedMinutes: 15,
        completionPercent: 0,
        relevanceScore: 0,
        authoredOrder: 0,
      })),
      lastLearningModuleServedAtBySection: {
        vr: "2026-01-04",
        dm: "2026-01-02",
        qr: "2026-01-03",
      },
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks.find((task) => task.taskType === "learn")?.sectionId,
    ).toBe("dm");
  });

  it("shrinks strict module practice and exposes catalog fallback diagnostics", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        {
          id: "vr-strict-shortage",
          title: "VR strict shortage",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 0,
          authoredOrder: 0,
          categoryIds: ["vr-weak"],
          questionTagIds: ["tag-a"],
          targetedPracticeInventory: {
            strictStemCount: 2,
            strictQuestionCount: 6,
            preferredTagStemCount: 1,
            preferredTagQuestionCount: 3,
          },
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks.find(
        (task) => task.launchConfig.learningModuleId === "vr-strict-shortage",
      )?.targetUnits,
    ).toBe(6);
    expect(result.contentGaps).toContainEqual({
      kind: "targeted_practice",
      sectionId: "vr",
      moduleId: "vr-strict-shortage",
      reason: "insufficient_strict_content",
      requestedQuestionCount: 27,
      availableQuestionCount: 6,
    });
  });

  it("suppresses the whole Learning loop when no strict whole stem fits", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [
        {
          id: "vr-no-strict-stem",
          title: "VR no strict stem",
          sectionId: "vr",
          sectionNumber: 1,
          priority: "essential",
          estimatedMinutes: 15,
          completionPercent: 0,
          relevanceScore: 0,
          authoredOrder: 0,
          targetedPracticeInventory: {
            strictStemCount: 1,
            strictQuestionCount: 12,
            preferredTagStemCount: 0,
            preferredTagQuestionCount: 0,
            strictSelectableQuestionCount: 0,
          },
        },
      ],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks.some(
        (task) => task.learningModuleId === "vr-no-strict-stem",
      ),
    ).toBe(false);
    expect(result.contentGaps).toContainEqual(
      expect.objectContaining({
        kind: "targeted_practice",
        moduleId: "vr-no-strict-stem",
        availableQuestionCount: 0,
      }),
    );
  });

  it("does not repeat diagnostics when equivalent section evidence exists", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 1,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        benchmarkCompleted: section.sectionNumber <= 3,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks.some((task) => task.taskType === "section_benchmark"),
    ).toBe(false);
  });

  it("best-fits ordinary Exam work inside a 60-minute envelope", () => {
    const result = generateStudyPlan({
      today: "2026-07-01",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        targetScore: 2500,
        availableDays: [0, 1, 2, 3, 4, 5].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 500 : null,
        evidenceCount: 1,
        completedFullSets: 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-06-01T00:00:00.000Z" : null,
        learningGraduationRoute: section.sectionNumber <= 3 ? "accuracy" : null,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(result.tasks.length).toBeGreaterThan(0);
    expect(result.readiness.mode).toBe("exam");
    const ordinaryDates = new Set(
      result.tasks
        .filter((task) => task.taskType === "practice")
        .map((task) => task.scheduledDate),
    );
    expect(ordinaryDates.size).toBeGreaterThan(0);
    for (const date of ordinaryDates) {
      const tasks = result.tasks.filter((task) => task.scheduledDate === date);
      expect(
        tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0),
      ).toBeLessThanOrEqual(60);
      expect(
        new Set(tasks.flatMap((task) => task.sectionId ?? [])).size,
      ).toBeLessThanOrEqual(3);
    }
  });

  it("uses prescribed-pace section diagnostics after basic learning exposure", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        targetScore: 2500,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    const benchmarks = result.tasks.filter(
      (task) => task.taskType === "section_benchmark",
    );
    expect(new Set(benchmarks.map((task) => task.sectionId)).size).toBe(3);
    expect(
      benchmarks.every(
        (task) =>
          task.questionSetId != null &&
          task.launchConfig.kind === "set" &&
          task.launchConfig.actualPace === 0.5 &&
          task.launchConfig.calibrationPurpose === "learning_diagnostic",
      ),
    ).toBe(true);
    expect(result.tasks.some((task) => task.taskType === "mock")).toBe(false);
  });

  it("allocates cognitive section targets that sum to the overall target", () => {
    const result = generateStudyPlan({
      today: "2026-05-01",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate:
          section.sectionNumber <= 3 ? 500 + section.sectionNumber * 80 : null,
        evidenceCount: 3,
        completedFullSets: 1,
        attemptedQuestionCount: 36,
        completedPracticeSessions: 2,
        qualifyingPracticeSessions: 2,
        largestPracticeSessionQuestionCount: 20,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.75,
        benchmarkCompleted: true,
        benchmarkPace: 0.8,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 1,
    });

    expect(
      Object.values(result.sectionTargets).reduce(
        (sum, score) => sum + score,
        0,
      ),
    ).toBe(2100);
    expect(result.tasks.some((task) => task.taskType === "mock")).toBe(true);
  });

  it("treats the preferred mock weekday as a preference, not a restriction", () => {
    const result = generateStudyPlan({
      today: "2026-07-03",
      planningDate: "2026-07-25",
      profile: {
        ...profile,
        availableDays: [{ weekday: 5 }, { weekday: 6 }],
        preferredMockWeekday: 6,
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 3,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-06-01T00:00:00.000Z" : null,
        learningGraduationRoute: section.sectionNumber <= 3 ? "accuracy" : null,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    const mocks = result.tasks.filter((task) => task.taskType === "mock");
    expect(mocks.length).toBeGreaterThanOrEqual(3);
    expect(
      mocks.some(
        (mock) => new Date(`${mock.scheduledDate}T00:00:00`).getDay() !== 6,
      ),
    ).toBe(true);
    expect(mocks.every((mock) => mock.scheduledDate < "2026-07-25")).toBe(true);
    expect(
      mocks.every(
        (mock) =>
          result.tasks.filter(
            (task) => task.scheduledDate === mock.scheduledDate,
          ).length === 2 &&
          result.tasks.some(
            (task) =>
              task.scheduledDate === mock.scheduledDate &&
              task.taskType === "review" &&
              task.sourceTaskRef?.scheduledDate === mock.scheduledDate &&
              task.sourceTaskRef.sortOrder === mock.sortOrder,
          ),
      ),
    ).toBe(true);
    expect(
      result.tasks.filter((task) => task.taskType === "review").length,
    ).toBeGreaterThan(0);
  });

  it.each([
    ["far-out Timing", "2026-01-01", "2026-06-01", 1],
    ["61–120 days", "2026-05-01", "2026-08-01", 2],
    ["29–60 days", "2026-06-20", "2026-08-01", 3],
    ["final 28 days", "2026-07-11", "2026-08-01", 9],
  ])(
    "uses the versioned mock cadence for %s",
    (_persona, today, planningDate, expectedMocks) => {
      const result = generateStudyPlan({
        today,
        planningDate,
        profile: {
          ...profile,
          testDate: planningDate,
          availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          })),
        },
        sections,
        signals: sections.map((section) => ({
          sectionId: section.id,
          currentEstimate: section.sectionNumber <= 3 ? 650 : null,
          evidenceCount: 3,
          completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
          learningGraduatedAt:
            section.sectionNumber <= 3 ? "2025-12-01T00:00:00.000Z" : null,
          learningGraduationRoute:
            section.sectionNumber <= 3 ? "accuracy" : null,
        })),
        learningModules: [],
        ...contentInputs,
        completedMockCount: 0,
      });

      expect(
        result.tasks.filter((task) => task.taskType === "mock"),
      ).toHaveLength(expectedMocks);
    },
  );

  it("counts recent completed mock SJT toward the rolling standalone allocation", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        sjtPreference: "normally",
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 450 : null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 1,
      lastCompletedMockDate: "2026-01-04",
    });

    expect(
      result.tasks.some(
        (task) => task.taskType === "practice" && task.sectionId === "sjt",
      ),
    ).toBe(false);
  });

  it("does not let an historical mock permanently suppress standalone SJT", () => {
    const result = generateStudyPlan({
      today: "2026-01-05",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        sjtPreference: "normally",
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 450 : null,
        evidenceCount: 0,
        completedFullSets: 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 1,
      lastCompletedMockDate: "2025-11-01",
    });

    expect(
      result.tasks
        .filter(
          (task) => task.taskType === "practice" && task.sectionId === "sjt",
        )
        .reduce((sum, task) => sum + (task.targetUnits ?? 0), 0),
    ).toBe(69);
  });

  it("keeps the final 48 hours free of mocks", () => {
    const planningDate = "2026-08-01";
    const result = generateStudyPlan({
      today: "2026-07-11",
      planningDate,
      profile: {
        ...profile,
        testDate: planningDate,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 3,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-06-01T00:00:00.000Z" : null,
        learningGraduationRoute: section.sectionNumber <= 3 ? "accuracy" : null,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks
        .filter((task) => task.taskType === "mock")
        .every((task) => task.scheduledDate <= "2026-07-29"),
    ).toBe(true);
  });

  it("uses targeted Exam practice when reliable weakness evidence exists", () => {
    const planningDate = "2026-08-01";
    const result = generateStudyPlan({
      today: "2026-07-11",
      planningDate,
      profile: {
        ...profile,
        testDate: planningDate,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        scoreConfidence: section.sectionNumber <= 3 ? "high" : null,
        evidenceCount: section.sectionNumber <= 3 ? 6 : 0,
        completedFullSets: section.sectionNumber <= 3 ? 2 : 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-05-01T00:00:00.000Z" : null,
        learningGraduationRoute:
          section.sectionNumber <= 3 ? "accuracy" : null,
        recentAccuracy: 0.6,
      })),
      learningModules: [],
      categories: timingCategories.map((category) => ({
        ...category,
        attemptedQuestionCount: 30,
        qualifyingPracticeSessions: 3,
        recentAccuracy: category.id.endsWith("-weak") ? 0.45 : 0.8,
      })),
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 2,
    });

    const examPractice = result.tasks.filter(
      (task) => task.taskType === "practice" && task.sectionId !== "sjt",
    );
    expect(examPractice.length).toBeGreaterThan(0);
    expect(
      examPractice.every(
        (task) =>
          Array.isArray(task.launchConfig.categoryIds) &&
          task.launchConfig.categoryIds.length > 0,
      ),
    ).toBe(true);
  });

  it("uses two final-month mocks only as a scarce-availability fallback", () => {
    const planningDate = "2026-08-01";
    const result = generateStudyPlan({
      today: "2026-07-20",
      planningDate,
      profile: {
        ...profile,
        testDate: planningDate,
        availableDays: [{ weekday: 1 }],
        preferredMockWeekday: 1,
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 3,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-06-01T00:00:00.000Z" : null,
        learningGraduationRoute: section.sectionNumber <= 3 ? "accuracy" : null,
        recentAccuracy: 0.7,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(
      result.tasks.filter((task) => task.taskType === "mock"),
    ).toHaveLength(2);
    for (const mock of result.tasks.filter(
      (task) => task.taskType === "mock",
    )) {
      const sameDay = result.tasks.filter(
        (task) => task.scheduledDate === mock.scheduledDate,
      );
      expect(sameDay.map((task) => task.taskType)).toEqual(["mock", "review"]);
      expect(sameDay[1]).toMatchObject({
        estimatedMinutes: 18,
        sourceTaskRef: {
          scheduledDate: mock.scheduledDate,
          sortOrder: mock.sortOrder,
        },
      });
    }
    expect(result.capacityRisk.level).toBe("warning");
  });

  it.each([
    ["normally", 69],
    ["a_little", 35],
    ["not_at_all", 0],
  ] as const)(
    "allocates standalone SJT work for the %s preference without cognitive target-gap weighting",
    (sjtPreference, expectedQuestions) => {
      const result = generateStudyPlan({
        today: "2026-01-05",
        planningDate: "2026-08-05",
        profile: {
          ...profile,
          sjtPreference,
          availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
            weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          })),
        },
        sections,
        signals: sections.map((section) => ({
          sectionId: section.id,
          currentEstimate: section.sectionNumber <= 3 ? 450 : null,
          evidenceCount: 0,
          completedFullSets: 0,
        })),
        learningModules: [],
        ...contentInputs,
        completedMockCount: 0,
      });
      const sjtQuestions = result.tasks
        .filter(
          (task) => task.taskType === "practice" && task.sectionId === "sjt",
        )
        .reduce((sum, task) => sum + (task.targetUnits ?? 0), 0);

      expect(sjtQuestions).toBe(expectedQuestions);
    },
  );

  it("schedules multiple core blocks and allows near-section overspeed work", () => {
    const result = generateStudyPlan({
      today: "2026-03-02",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 5,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        observedPace: 1.35,
        attemptedQuestionCount: 36,
        completedPracticeSessions: 2,
        qualifyingPracticeSessions: 2,
        largestPracticeSessionQuestionCount: 20,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.75,
        benchmarkCompleted: true,
        benchmarkPace: 0.8,
        prescribedPace: 1,
        overspeedEligible: true,
        overspeedPace: 1.3,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 1,
    });

    const practiceByDate = new Map<string, number>();
    for (const task of result.tasks.filter(
      (candidate) => candidate.taskType === "practice",
    )) {
      practiceByDate.set(
        task.scheduledDate,
        (practiceByDate.get(task.scheduledDate) ?? 0) + 1,
      );
    }
    expect([...practiceByDate.values()].some((count) => count >= 2)).toBe(true);
    expect(
      result.tasks.some(
        (task) =>
          task.taskType === "practice" &&
          task.launchConfig.timeSpeedMultiplier === 1.3 &&
          (task.targetUnits ?? 0) >= 28,
      ),
    ).toBe(true);
    const timingPractice = result.tasks.filter(
      (task) => task.taskType === "practice",
    );
    const broadOrMixed = timingPractice.filter((task) => {
      const categoryIds = task.launchConfig.categoryIds;
      return Array.isArray(categoryIds) && categoryIds.length !== 1;
    });
    const targeted = timingPractice.filter((task) => {
      const categoryIds = task.launchConfig.categoryIds;
      return Array.isArray(categoryIds) && categoryIds.length > 0;
    });
    const overspeed = targeted.filter(
      (task) => Number(task.launchConfig.timeSpeedMultiplier) > 1,
    );
    expect(broadOrMixed.length).toBeGreaterThanOrEqual(
      Math.floor(timingPractice.length / 2),
    );
    expect(overspeed.length).toBeLessThanOrEqual(
      Math.ceil(targeted.length / 4),
    );
    expect(result.tasks.some((task) => task.sectionId === "sjt")).toBe(false);
  });

  it("limits due calibrations to one third of ordinary Timing sessions", () => {
    const result = generateStudyPlan({
      today: "2026-03-02",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 5,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.75,
        benchmarkCompleted: true,
        benchmarkPace: 0.8,
        prescribedPace: 0.8,
        calibrationDue: section.sectionNumber <= 3,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 1,
    });

    const ordinary = result.tasks.filter(
      (task) => task.taskType === "practice",
    ).length;
    const calibrations = result.tasks.filter(
      (task) => task.taskType === "section_benchmark",
    ).length;
    expect(calibrations).toBeGreaterThan(0);
    expect(calibrations / (ordinary + calibrations)).toBeLessThanOrEqual(1 / 3);
  });

  it("packs required work inside the daily time and three-section envelope", () => {
    const result = generateStudyPlan({
      today: "2026-05-04",
      planningDate: "2026-07-05",
      profile: {
        ...profile,
        targetScore: 2600,
        availableDays: [{ weekday: 1 }],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 450 : null,
        scoreConfidence: "high" as const,
        evidenceCount: 5,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.55,
        benchmarkCompleted: true,
        prescribedPace: 0.8,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-04-01T00:00:00.000Z" : null,
        learningGraduationRoute:
          section.sectionNumber <= 3 ? "experience" : null,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 0,
    });

    const requiredByDate = new Map<string, typeof result.tasks>();
    for (const task of result.tasks.filter(
      (candidate) =>
        candidate.taskType !== "review" &&
        candidate.taskType !== "skill_trainer" &&
        candidate.taskType !== "mock",
    )) {
      requiredByDate.set(task.scheduledDate, [
        ...(requiredByDate.get(task.scheduledDate) ?? []),
        task,
      ]);
    }
    expect(
      [...requiredByDate.values()].some((tasks) => tasks.length >= 2),
    ).toBe(true);
    for (const tasks of requiredByDate.values()) {
      expect(
        new Set(tasks.flatMap((task) => task.sectionId ?? [])).size,
      ).toBeLessThanOrEqual(3);
      const date = tasks[0]!.scheduledDate;
      if (tasks.every((task) => task.taskType === "practice")) {
        const dayTasks = result.tasks.filter(
          (task) => task.scheduledDate === date,
        );
        const totalMinutes = dayTasks.reduce(
          (sum, task) => sum + task.estimatedMinutes,
          0,
        );
        expect(totalMinutes).toBeLessThanOrEqual(60);
      }
    }
  });

  it("keeps each calibration day exclusive of unrelated required work", () => {
    const result = generateStudyPlan({
      today: "2026-03-02",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        targetScore: 2500,
        availableDays: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        })),
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 600 : null,
        evidenceCount: 5,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.7,
        benchmarkCompleted: true,
        calibrationDue: section.sectionNumber <= 3,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 0,
    });
    const calibrationDates = new Set(
      result.tasks
        .filter((task) => task.taskType === "section_benchmark")
        .map((task) => task.scheduledDate),
    );
    expect(calibrationDates.size).toBeGreaterThan(0);
    for (const date of calibrationDates) {
      expect(
        result.tasks.filter(
          (task) =>
            task.scheduledDate === date &&
            task.taskType !== "section_benchmark" &&
            task.taskType !== "review",
        ),
      ).toHaveLength(0);
    }
  });

  it("warns when the student selects too few study days for the phase", () => {
    const result = generateStudyPlan({
      today: "2026-06-15",
      planningDate: "2026-07-05",
      profile: {
        ...profile,
        targetScore: 2600,
        availableDays: [{ weekday: 1 }],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 400 : null,
        scoreConfidence: "high" as const,
        evidenceCount: 5,
        completedFullSets: 0,
        learningGraduatedAt:
          section.sectionNumber <= 3 ? "2026-06-01T00:00:00.000Z" : null,
        learningGraduationRoute: section.sectionNumber <= 3 ? "accuracy" : null,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(result.capacityRisk).toMatchObject({ level: "warning" });
    expect(result.capacityRisk.outstandingSectionEquivalents).toBeGreaterThan(
      result.capacityRisk.schedulableSectionEquivalents,
    );
    expect(result.capacityRisk.message).toBe(
      "You selected fewer study days than the exam phase normally needs. The plan will prioritise mocks and the highest-value weaknesses on the days you selected.",
    );
  });

  it("does not advance prescribed pace from scheduled work", () => {
    const result = generateStudyPlan({
      today: "2026-03-02",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        availableDays: [
          { weekday: 1 },
          { weekday: 2 },
          { weekday: 3 },
          { weekday: 4 },
          { weekday: 5 },
        ],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 620 : null,
        evidenceCount: 5,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
        observedPace: 0.5,
        attemptedQuestionCount: 36,
        completedPracticeSessions: 2,
        qualifyingPracticeSessions: 2,
        largestPracticeSessionQuestionCount: 20,
        representativeSessionCount: 2,
        representativeSectionEquivalents: 1,
        representativeAccuracy: 0.75,
        benchmarkCompleted: true,
        benchmarkPace: 0.8,
      })),
      learningModules: [],
      categories: timingCategories,
      skillTrainers,
      benchmarkSets,
      benchmarkMocks,
      completedMockCount: 1,
    });

    const plannedPaces = result.tasks.flatMap((task) =>
      task.taskType === "practice" &&
      typeof task.launchConfig.timeSpeedMultiplier === "number"
        ? [task.launchConfig.timeSpeedMultiplier]
        : [],
    );
    expect(plannedPaces).toContain(0.5);
    expect(plannedPaces.every((pace) => pace === 0.5)).toBe(true);
  });
});

describe("generateExtraStudyTasks", () => {
  const signals = sections.map((section) => ({
    sectionId: section.id,
    currentEstimate:
      section.id === "dm" ? 430 : section.sectionNumber <= 3 ? 650 : null,
    evidenceCount: 3,
    completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
  }));

  it("uses a brief warm-up then targets the weakest scored section by default", () => {
    const tasks = generateExtraStudyTasks({
      today: "2026-07-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 30,
      sectionKey: null,
      sections,
      signals,
      categories,
      skillTrainers,
      sortOrder: 4,
    });

    const task = tasks.find((candidate) => candidate.taskType === "practice");
    expect(task).toMatchObject({
      scheduledDate: "2026-07-15",
      sortOrder: 5,
      taskType: "practice",
      sectionId: "dm",
      questionStemCategoryId: "dm-weak",
      estimatedMinutes: 30,
    });
    expect(task?.launchConfig).toMatchObject({
      extraStudy: true,
      requestedMinutes: 30,
      requestedSectionKey: null,
    });
  });

  it("uses canonical readiness for extra-study phase and pace", () => {
    const tasks = generateExtraStudyTasks({
      today: "2026-01-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 20,
      sectionKey: "verbal_reasoning",
      sections,
      signals: signals.map((signal) => ({
        ...signal,
        observedPace: null,
        completedFullSets: 0,
      })),
      categories,
      skillTrainers: [],
      sortOrder: 0,
      readiness: {
        sections: [
          {
            sectionId: "vr",
            mode: "timing",
            paceMultiplier: 0.9,
          },
        ],
      } as never,
    });

    expect(tasks[0]?.launchConfig).toMatchObject({
      timeMode: "speed",
      timeSpeedMultiplier: 0.9,
    });
  });

  it("falls back to broad section practice when no category evidence exists", () => {
    const tasks = generateExtraStudyTasks({
      today: "2026-07-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 30,
      sectionKey: "verbal_reasoning",
      sections,
      signals,
      categories: [],
      skillTrainers: [],
      sortOrder: 0,
    });

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      taskType: "practice",
      sectionId: "vr",
      questionStemCategoryId: null,
      estimatedMinutes: 30,
      launchConfig: {
        categoryIds: [],
        requestedSectionKey: "verbal_reasoning",
      },
    });
  });

  it("uses a linked skill trainer for a short section-specific session", () => {
    const tasks = generateExtraStudyTasks({
      today: "2026-07-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 10,
      sectionKey: "verbal_reasoning",
      sections,
      signals,
      categories,
      skillTrainers,
      sortOrder: 0,
    });

    expect(tasks[0]).toMatchObject({
      taskType: "skill_trainer",
      sectionId: "vr",
      skillTrainerId: "vr-trainer",
      launchPath: "/skill-trainer/verbal-reasoning-warmup/play",
    });
    expect(tasks[0].launchConfig).toMatchObject({
      extraStudy: true,
      optional: true,
      requestedMinutes: 10,
      requestedSectionKey: "verbal_reasoning",
    });
    expect(tasks.map((task) => task.taskType)).toEqual([
      "skill_trainer",
      "practice",
    ]);
    expect(tasks[1]?.estimatedMinutes).toBe(10);
    expect(
      tasks.reduce((total, task) => total + task.estimatedMinutes, 0),
    ).toBeGreaterThan(10);
  });

  it("derives review time from question exam time and expected accuracy", () => {
    const [practice] = generateExtraStudyTasks({
      today: "2026-07-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 20,
      sectionKey: "situational_judgement",
      sections,
      signals,
      categories,
      skillTrainers: [],
      sortOrder: 0,
    });

    expect(
      reviewTask(
        {
          ...practice,
          targetUnits: 20,
          launchConfig: {
            ...practice.launchConfig,
            examTimePerQuestionSeconds: 47,
            expectedAccuracy: 0.8,
          },
        },
        practice.scheduledDate,
        1,
      ).estimatedMinutes,
    ).toBe(2);
  });

  it("honours an explicit SJ preference without making SJ the default", () => {
    const tasks = generateExtraStudyTasks({
      today: "2026-07-15",
      planningDate: "2026-08-05",
      targetScore: 2100,
      minutes: 20,
      sectionKey: "situational_judgement",
      sections,
      signals,
      categories,
      skillTrainers,
      sortOrder: 0,
    });

    expect(
      tasks.find((candidate) => candidate.taskType === "practice"),
    ).toMatchObject({
      taskType: "practice",
      sectionId: "sjt",
      questionStemCategoryId: "sjt-weak",
    });
  });
});
