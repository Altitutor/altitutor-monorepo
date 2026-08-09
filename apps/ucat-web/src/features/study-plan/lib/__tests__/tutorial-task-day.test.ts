import { resolveTutorialTaskDay } from "@/features/study-plan/lib/tutorial-task-day";

describe("Study plan tutorial task day", () => {
  it("keeps today selected when it already has tasks", () => {
    expect(
      resolveTutorialTaskDay({
        today: "2026-08-09",
        todayHasTasks: true,
        taskDates: ["2026-08-11"],
      }),
    ).toEqual({ date: "2026-08-09", requiresSelection: false });
  });

  it("asks for the next task-bearing day when today is empty", () => {
    expect(
      resolveTutorialTaskDay({
        today: "2026-08-09",
        todayHasTasks: false,
        taskDates: ["2026-08-14", "2026-08-11", "2026-08-08"],
      }),
    ).toEqual({ date: "2026-08-11", requiresSelection: true });
  });

  it("falls back without blocking when no future task day exists", () => {
    expect(
      resolveTutorialTaskDay({
        today: "2026-08-09",
        todayHasTasks: false,
        taskDates: ["2026-08-08"],
      }),
    ).toEqual({ date: null, requiresSelection: false });
  });
});
