import type { SectionProgress } from "@/app/api/ucat/progress/route";
import { getSectionProgressPercentage } from "../progress-data-utils";

function sectionProgress(percentage: number): SectionProgress {
  return {
    sectionId: "section-1",
    sectionName: "Verbal Reasoning",
    sectionNumber: 1,
    correctScore: 7,
    maxScore: 10,
    percentage,
  };
}

describe("progress-data-utils", () => {
  it("uses raw section percentage in every mode", () => {
    expect(getSectionProgressPercentage(sectionProgress(70), "all_time")).toBe(
      70,
    );
    expect(getSectionProgressPercentage(sectionProgress(70), "weighted")).toBe(
      70,
    );
  });
});
