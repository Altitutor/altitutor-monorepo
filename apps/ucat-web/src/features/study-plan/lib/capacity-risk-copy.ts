import type { StudyPlanCapacityRisk } from "@/features/study-plan/model/types";

export const STUDENT_CAPACITY_RISK_MESSAGE =
  "Add another study day to give the plan more chances to practise and review what you learn.";

const LEGACY_DEMAND_CAPACITY_TERMS =
  /section-equivalents|intensity envelope|cannot fit every recommended activity/i;

export function isLegacyDemandCapacityRiskMessage(
  message: string | null,
): boolean {
  return message != null && LEGACY_DEMAND_CAPACITY_TERMS.test(message);
}

export function studentCapacityRiskMessage(
  capacityRisk: StudyPlanCapacityRisk,
): string {
  if (
    capacityRisk.message == null ||
    isLegacyDemandCapacityRiskMessage(capacityRisk.message)
  ) {
    return STUDENT_CAPACITY_RISK_MESSAGE;
  }

  return capacityRisk.message;
}
