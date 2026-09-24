import type { SectionProgress } from "@altitutor/shared";
import {
  buildAttemptAxisGraphData,
  getSectionProgressPercentage,
} from "../progress-data-utils";

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

  it("builds one chronological point per attempt for attempt x-axis", () => {
    const points = buildAttemptAxisGraphData(
      [
        { id: "b", at: "2026-07-02T10:00:00Z", value: 80 },
        { id: "a", at: "2026-07-01T10:00:00Z", value: 60 },
      ],
      (item) => item.at,
      (item) => item.value,
      (item) => item.id,
      (_item, index) => String(index + 1),
      (item, index) => `Attempt #${index + 1} · ${item.id}`,
    );

    expect(points).toEqual([
      {
        date: "a",
        value: 60,
        label: "1",
        tooltipLabel: "Attempt #1 · a",
      },
      {
        date: "b",
        value: 80,
        label: "2",
        tooltipLabel: "Attempt #2 · b",
      },
    ]);
  });
});
