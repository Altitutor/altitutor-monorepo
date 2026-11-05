import { plannedAttendanceTone, statusLabel, statusToneClass } from "../statusTone";

describe("status tone", () => {
  it("uses the same colours for the statuses shown on chips and calendars", () => {
    expect(statusToneClass("ACTIVE")).toBe(statusToneClass("active"));
    expect(statusToneClass("ACTIVE")).toContain("green");
    expect(statusToneClass("DISCONTINUED")).toContain("red");
    expect(statusToneClass("INACTIVE")).toContain("gray");
    expect(statusToneClass("cancelled")).toContain("red");
    expect(statusLabel("COMPLETED")).toBe("Completed");
  });

  it("colours planned attendance green and absence red", () => {
    expect(plannedAttendanceTone("attending-extra")).toBe("attending");
    expect(plannedAttendanceTone("absent")).toBe("absent");
    expect(plannedAttendanceTone("unplanned")).toBe("absent");
  });
});
