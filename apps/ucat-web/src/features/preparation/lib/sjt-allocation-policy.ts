import type { StudyPlanSjtPreference } from "@/features/study-plan/model/types";
import type { StudyPlanTimingEvidenceSession } from "@/features/study-plan/model/types";
import { daysBetween } from "@/features/study-plan/lib/dates";

export const SJT_ALLOCATION_WEIGHTS: Readonly<
  Record<StudyPlanSjtPreference, number>
> = Object.freeze({
  normally: 1,
  a_little: 0.5,
  not_at_all: 0,
});

export const DEFAULT_SJT_PREFERENCE: StudyPlanSjtPreference = "a_little";
export const SJT_MOCK_CREDIT_WINDOW_DAYS = 21;

export function isSjtPreference(
  value: unknown,
): value is StudyPlanSjtPreference {
  return (
    typeof value === "string" &&
    Object.hasOwn(SJT_ALLOCATION_WEIGHTS, value)
  );
}

export function normalizeSjtPreference(
  value: unknown,
): StudyPlanSjtPreference {
  return isSjtPreference(value) ? value : DEFAULT_SJT_PREFERENCE;
}

export function sjtAllocationWeight(
  preference: StudyPlanSjtPreference | undefined,
): number {
  return SJT_ALLOCATION_WEIGHTS[preference ?? DEFAULT_SJT_PREFERENCE];
}

export function latestCompletedMockDate(
  sessions: readonly StudyPlanTimingEvidenceSession[] | undefined,
): string | null {
  return [...(sessions ?? [])]
    .filter((session) => session.source === "mock")
    .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0]
    ?.completedAt.slice(0, 10) ?? null;
}

export function hasCurrentSjtMockCredit(input: {
  today: string;
  lastCompletedMockDate?: string | null;
}): boolean {
  if (!input.lastCompletedMockDate) return false;
  const ageDays = daysBetween(input.lastCompletedMockDate, input.today);
  return ageDays >= 0 && ageDays <= SJT_MOCK_CREDIT_WINDOW_DAYS;
}
