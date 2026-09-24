import type {
  StudyPlanAvailability,
  StudyPlanWeekday,
} from "@/features/study-plan/model/types";

export function inferPreferredMockWeekday(
  availability: StudyPlanAvailability[],
): StudyPlanWeekday {
  const [best] = [...availability].sort((a, b) => {
    const aWeekend = a.weekday === 0 || a.weekday === 6 ? 1 : 0;
    const bWeekend = b.weekday === 0 || b.weekday === 6 ? 1 : 0;
    if (bWeekend !== aWeekend) return bWeekend - aWeekend;
    return a.weekday - b.weekday;
  });
  return best?.weekday ?? 6;
}
