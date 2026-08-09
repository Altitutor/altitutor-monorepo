interface ResolveTutorialTaskDayInput {
  today: string;
  todayHasTasks: boolean;
  taskDates: readonly string[];
}

export interface TutorialTaskDay {
  date: string | null;
  requiresSelection: boolean;
}

/** Pick the task-bearing day the Study plan tutorial should present. */
export function resolveTutorialTaskDay({
  today,
  todayHasTasks,
  taskDates,
}: ResolveTutorialTaskDayInput): TutorialTaskDay {
  if (todayHasTasks) {
    return { date: today, requiresSelection: false };
  }

  let nextTaskDate: string | null = null;
  for (const taskDate of taskDates) {
    if (taskDate <= today) continue;
    if (nextTaskDate == null || taskDate < nextTaskDate) {
      nextTaskDate = taskDate;
    }
  }

  return {
    date: nextTaskDate,
    requiresSelection: nextTaskDate != null,
  };
}
