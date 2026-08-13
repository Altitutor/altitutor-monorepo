import {
  isTestDateInBounds,
  testDateBounds,
} from "@/features/study-plan/lib/test-date-bounds";

describe("testDateBounds", () => {
  it("uses today as min when the year has already started", () => {
    expect(testDateBounds(2026, "2026-08-10")).toEqual({
      minDate: "2026-08-10",
      maxDate: "2026-12-31",
    });
  });

  it("uses year start as min for a future year", () => {
    expect(testDateBounds(2027, "2026-08-10")).toEqual({
      minDate: "2027-01-01",
      maxDate: "2027-12-31",
    });
  });
});

describe("isTestDateInBounds", () => {
  const today = "2026-08-10";

  it("rejects past dates in the selected year", () => {
    expect(isTestDateInBounds("2026-08-09", 2026, today)).toBe(false);
  });

  it("accepts today and future dates in the selected year", () => {
    expect(isTestDateInBounds("2026-08-10", 2026, today)).toBe(true);
    expect(isTestDateInBounds("2026-09-15", 2026, today)).toBe(true);
  });

  it("rejects dates outside the selected year", () => {
    expect(isTestDateInBounds("2027-09-15", 2026, today)).toBe(false);
  });
});
