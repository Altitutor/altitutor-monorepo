import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

function activity(
  overrides: Partial<StudyPlanTask>,
): Pick<
  StudyPlanTask,
  "taskType" | "launchConfig" | "mockId" | "questionSetId"
> {
  return {
    taskType: "practice",
    launchConfig: {},
    mockId: null,
    questionSetId: null,
    ...overrides,
  };
}

describe("studyPlanActivityTypeLabel", () => {
  it.each([
    ["practice", "Practice questions"],
    ["section_benchmark", "Set"],
    ["mock", "Mock"],
    ["learn", "Learning module"],
    ["skill_trainer", "Skill trainer"],
  ] as const)("labels %s activities", (taskType, expected) => {
    expect(studyPlanActivityTypeLabel(activity({ taskType }))).toBe(expected);
  });

  it.each([
    ["practice", "Review of practice questions"],
    ["section_benchmark", "Review of set"],
    ["mock", "Review of mock"],
  ] as const)("labels reviews of %s activities", (taskType, expected) => {
    expect(
      studyPlanActivityTypeLabel(activity({ taskType: "review" }), {
        taskType,
      }),
    ).toBe(expected);
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
