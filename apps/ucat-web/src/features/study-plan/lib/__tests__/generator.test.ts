import { generateStudyPlan } from "@/features/study-plan/lib/generator";
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
  ["sjt", "situational_judgement", "Situational Judgement", "SJT", 4, 69, 32],
].map(([id, key, name, shortName, sectionNumber, questionCount, timePerQuestionSeconds]) => ({
  id: String(id),
  key: key as StudyPlanSection["key"],
  name: String(name),
  shortName: String(shortName),
  sectionNumber: Number(sectionNumber),
  questionCount: Number(questionCount),
  timePerQuestionSeconds: Number(timePerQuestionSeconds),
}));

const profile: StudyPlanProfileInput = {
  targetScore: 2100,
  testYear: 2026,
  testDate: "2026-08-05",
  availableDays: [
    { weekday: 1, maxMinutes: 90 },
    { weekday: 3, maxMinutes: 90 },
    { weekday: 6, maxMinutes: 150 },
  ],
  preferredMockWeekday: 6,
};

const categories: StudyPlanCategorySignal[] = sections.flatMap((section, index) => [
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
]);

const skillTrainers: StudyPlanSkillTrainer[] = sections.slice(0, 3).map((section) => ({
  id: `${section.id}-trainer`,
  key: `${section.key}_warmup`,
  name: `${section.shortName} warm-up`,
  sectionId: section.id,
  categoryIds: [`${section.id}-weak`],
  estimatedMinutes: 6,
}));

const contentInputs = { categories, skillTrainers };

describe("generateStudyPlan", () => {
  it("starts with short feedback loops and schedules section benchmarks before mocks", () => {
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
      learningModules: [{
        id: "lesson-1",
        title: "How to approach VR passages",
        sectionId: "vr",
        priority: "essential",
        estimatedMinutes: 20,
        completionPercent: 0,
        relevanceScore: 1,
      }],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(result.tasks[0]).toMatchObject({ taskType: "learn", learningModuleId: "lesson-1" });
    const firstPractice = result.tasks.find((task) => task.taskType === "practice");
    expect(firstPractice?.launchConfig).toMatchObject({
      timeMode: "off",
      reviewTiming: "afterEachStem",
    });
    const benchmarkIndices = sections.slice(0, 3).map((section) =>
      result.tasks.findIndex(
        (task) => task.taskType === "section_benchmark" && task.sectionId === section.id,
      ),
    );
    expect(benchmarkIndices.every((index) => index >= 0)).toBe(true);
    expect(result.tasks.some((task) => task.taskType === "mock")).toBe(false);
    expect(firstPractice?.questionStemCategoryId).toBe("vr-weak");
    expect(result.tasks.some((task) => task.taskType === "skill_trainer")).toBe(true);
    expect(result.tasks.some((task) => task.taskType === "review")).toBe(true);
  });

  it("does not block a constrained student and reports capacity risk", () => {
    const result = generateStudyPlan({
      today: "2026-07-01",
      planningDate: "2026-08-05",
      profile: {
        ...profile,
        targetScore: 2500,
        availableDays: [{ weekday: 6, maxMinutes: 30 }],
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 500 : null,
        evidenceCount: 1,
        completedFullSets: 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    expect(result.capacityRisk.level).toBe("warning");
    expect(result.tasks.length).toBeGreaterThan(0);
    expect(Math.max(...result.tasks.map((task) => task.estimatedMinutes))).toBeLessThanOrEqual(30);
  });

  it("allocates cognitive section targets that sum to the overall target", () => {
    const result = generateStudyPlan({
      today: "2026-05-01",
      planningDate: "2026-08-05",
      profile,
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 500 + section.sectionNumber * 80 : null,
        evidenceCount: 3,
        completedFullSets: 1,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 1,
    });

    expect(Object.values(result.sectionTargets).reduce((sum, score) => sum + score, 0)).toBe(2100);
    expect(result.tasks.some((task) => task.taskType === "mock")).toBe(true);
  });

  it("carries a review into the next available session when the attempt fills the day", () => {
    const result = generateStudyPlan({
      today: "2026-07-04",
      planningDate: "2026-07-11",
      profile: {
        ...profile,
        availableDays: [{ weekday: 6, maxMinutes: 200 }],
        preferredMockWeekday: 6,
      },
      sections,
      signals: sections.map((section) => ({
        sectionId: section.id,
        currentEstimate: section.sectionNumber <= 3 ? 650 : null,
        evidenceCount: 3,
        completedFullSets: section.sectionNumber <= 3 ? 1 : 0,
      })),
      learningModules: [],
      ...contentInputs,
      completedMockCount: 0,
    });

    const mock = result.tasks.find((task) => task.taskType === "mock");
    const review = result.tasks.find((task) => task.taskType === "review");
    expect(mock).toBeDefined();
    expect(review?.scheduledDate).toBe("2026-07-11");
    expect(review?.launchConfig).toMatchObject({
      sourceTaskScheduledDate: mock?.scheduledDate,
      sourceTaskSortOrder: mock?.sortOrder,
    });
  });
});
