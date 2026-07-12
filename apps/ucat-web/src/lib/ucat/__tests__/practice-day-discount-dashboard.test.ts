import {
  practiceDiscountRecentWindowDays,
  resolveBillingDateInWindow,
} from "@/lib/ucat/practice-day-discount-dashboard";

describe("practice-day-discount-dashboard window", () => {
  it("uses 7 days for weekly billing and 30 otherwise", () => {
    expect(practiceDiscountRecentWindowDays("week")).toBe(7);
    expect(practiceDiscountRecentWindowDays("month")).toBe(30);
    expect(practiceDiscountRecentWindowDays("year")).toBe(30);
    expect(practiceDiscountRecentWindowDays(null)).toBe(30);
  });

  it("prefers period end when it falls in the window", () => {
    const dates = [
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ];
    expect(
      resolveBillingDateInWindow(
        dates,
        "2026-06-07T00:00:00.000Z",
        "2026-06-14T00:00:00.000Z",
        "UTC",
        "week",
      ),
    ).toBe("2026-06-14");
  });

  it("falls back to period start when end is outside the window", () => {
    const dates = [
      "2026-06-08",
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ];
    expect(
      resolveBillingDateInWindow(
        dates,
        "2026-06-08T00:00:00.000Z",
        "2026-06-15T00:00:00.000Z",
        "UTC",
        "week",
      ),
    ).toBe("2026-06-08");
  });

  it("matches weekday when exact period dates are outside the window", () => {
    // period_end is Monday 2026-06-15; window ends Sunday 2026-06-14
    const dates = [
      "2026-06-08", // Mon
      "2026-06-09",
      "2026-06-10",
      "2026-06-11",
      "2026-06-12",
      "2026-06-13",
      "2026-06-14",
    ];
    expect(
      resolveBillingDateInWindow(
        dates,
        "2026-06-01T00:00:00.000Z",
        "2026-06-15T00:00:00.000Z",
        "UTC",
        "week",
      ),
    ).toBe("2026-06-08");
  });

  it("matches day-of-month for monthly windows", () => {
    const dates = Array.from({ length: 30 }, (_, i) => {
      const day = i + 1;
      return `2026-06-${String(day).padStart(2, "0")}`;
    });
    expect(
      resolveBillingDateInWindow(
        dates,
        "2026-05-12T00:00:00.000Z",
        "2026-07-12T00:00:00.000Z",
        "UTC",
        "month",
      ),
    ).toBe("2026-06-12");
  });
});
