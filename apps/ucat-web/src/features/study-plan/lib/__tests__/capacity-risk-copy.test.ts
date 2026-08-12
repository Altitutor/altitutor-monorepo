import {
  STUDENT_CAPACITY_RISK_MESSAGE,
  studentCapacityRiskMessage,
} from "@/features/study-plan/lib/capacity-risk-copy";
import type { StudyPlanCapacityRisk } from "@/features/study-plan/model/types";

function risk(message: string | null): StudyPlanCapacityRisk {
  return {
    level: "warning",
    availableStudyDaysPerWeek: 1,
    recommendedStudyDaysPerWeek: 2,
    outstandingSectionEquivalents: 15.3,
    schedulableSectionEquivalents: 8,
    message,
  };
}

describe("studentCapacityRiskMessage", () => {
  it("translates persisted internal capacity jargon", () => {
    expect(
      studentCapacityRiskMessage(
        risk(
          "15.3 outstanding section-equivalents cannot fit inside the sustainable 21-day intensity envelope.",
        ),
      ),
    ).toBe(STUDENT_CAPACITY_RISK_MESSAGE);
  });

  it("preserves student-facing guidance for other capacity risks", () => {
    const message =
      "There may not be enough broad practice opportunities before the exam phase.";
    expect(studentCapacityRiskMessage(risk(message))).toBe(message);
  });
});
