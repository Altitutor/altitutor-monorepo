import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

function activity(
  overrides: Partial<StudyPlanTask>,
): Pick<
  StudyPlanTask,
  | "taskType"
  | "launchConfig"
  | "mockId"
  | "questionSetId"
  | "questionStemCategoryId"
> {
  return {
    taskType: "practice",
    launchConfig: {},
    mockId: null,
    questionSetId: null,
    questionStemCategoryId: null,
    ...overrides,
  };
}

describe("studyPlanActivityTypeLabel", () => {
  it.each([
    ["practice", "Broad practice"],
    ["section_benchmark", "Set"],
    ["mock", "Mock"],
    ["learn", "Learning module"],
    ["skill_trainer", "Skill trainer"],
  ] as const)("labels %s activities", (taskType, expected) => {
    expect(studyPlanActivityTypeLabel(activity({ taskType }))).toBe(expected);
  });

  it.each([
    ["practice", "Review of broad practice"],
    ["section_benchmark", "Review of set"],
    ["mock", "Review of mock"],
  ] as const)("labels reviews of %s activities", (taskType, expected) => {
    expect(
      studyPlanActivityTypeLabel(activity({ taskType: "review" }), {
        ...activity({ taskType }),
      }),
    ).toBe(expected);
  });

  it("distinguishes filtered targeted practice from broad practice", () => {
    const targeted = activity({
      launchConfig: { categoryIds: ["category-1"] },
    });
    expect(studyPlanActivityTypeLabel(targeted)).toBe("Targeted practice");
    expect(
      studyPlanActivityTypeLabel(activity({ taskType: "review" }), targeted),
    ).toBe("Review of targeted practice");
    expect(
      studyPlanActivityTypeLabel(
        activity({
          taskType: "review",
          launchConfig: { sourcePracticeScope: "targeted" },
        }),
      ),
    ).toBe("Review of targeted practice");
  });

  it("uses the linked attempt type for standalone review guidance", () => {
    expect(
      studyPlanActivityTypeLabel({
        ...activity({ taskType: "review" }),
        sourceAttemptType: "set_attempt",
      }),
    ).toBe("Review of set");
  });
});
