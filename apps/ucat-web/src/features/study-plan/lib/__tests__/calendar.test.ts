import {
  buildStudyPlanCalendarMonths,
  daysBetweenDateKeys,
  studyPlanCalendarIntensityLevel,
  studyPlanPlannedMinutes,
} from "@/features/study-plan/lib/calendar";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

function task(
  partial: Pick<StudyPlanTask, "taskType" | "estimatedMinutes">,
): StudyPlanTask {
  return {
    id: "task",
    scheduledDate: "2026-07-15",
    sortOrder: 0,
    title: "Task",
    description: "",
    rationale: "",
    targetUnits: null,
    sectionId: null,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/",
    launchConfig: {},
    status: "planned",
    sourceTaskId: null,
    completedUnits: 0,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    matchedActivityType: null,
    matchedActivityId: null,
    ...partial,
  };
}

describe("Study plan calendar", () => {
  it("builds stable six-week month grids with Monday first", () => {
    const [july] = buildStudyPlanCalendarMonths("2026-07-15", "2026-07-31");

    expect(july.key).toBe("2026-07");
    expect(july.days).toHaveLength(42);
    expect(july.days[2]?.dateKey).toBe("2026-07-01");
    expect(july.days[32]?.dateKey).toBe("2026-07-31");
  });

  it("builds every month in an inclusive range", () => {
    expect(
      buildStudyPlanCalendarMonths("2026-07-15", "2026-09-01").map(
        (month) => month.key,
      ),
    ).toEqual(["2026-07", "2026-08", "2026-09"]);
  });

  it("calculates date countdowns without daylight-saving drift", () => {
    expect(daysBetweenDateKeys("2026-09-30", "2026-10-04")).toBe(4);
  });

  it("counts the complete planned workload", () => {
    expect(
      studyPlanPlannedMinutes([
        task({ taskType: "practice", estimatedMinutes: 30 }),
        task({ taskType: "review", estimatedMinutes: 15 }),
        task({ taskType: "learn", estimatedMinutes: 20 }),
      ]),
    ).toBe(65);
  });

  it("scales practice load against the visible window maximum", () => {
    expect(studyPlanCalendarIntensityLevel(0, 60)).toBe(0);
    expect(studyPlanCalendarIntensityLevel(15, 60)).toBe(1);
    expect(studyPlanCalendarIntensityLevel(30, 60)).toBe(2);
    expect(studyPlanCalendarIntensityLevel(45, 60)).toBe(3);
    expect(studyPlanCalendarIntensityLevel(60, 60)).toBe(4);
  });
});
