import type { StudyPlanCapacityRisk } from "@/features/study-plan/model/types";

export const STUDENT_CAPACITY_RISK_MESSAGE =
  "Your available study time cannot fit every recommended activity into the next 21 days. Add another study day if you want to cover more sooner.";

const INTERNAL_CAPACITY_TERMS = /section-equivalents|intensity envelope/i;

export function studentCapacityRiskMessage(
  capacityRisk: StudyPlanCapacityRisk,
): string {
  if (
    capacityRisk.message == null ||
    INTERNAL_CAPACITY_TERMS.test(capacityRisk.message)
  ) {
    return STUDENT_CAPACITY_RISK_MESSAGE;
  }

  return capacityRisk.message;
}
