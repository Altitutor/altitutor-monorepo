import {
  isCreditDateInBillingPeriod,
  localDateStringInTimezone,
} from "@/lib/ucat/practice-day-discount-period";

describe("practice-day-discount-period", () => {
  it("formats local date in timezone", () => {
    const date = new Date("2026-06-15T14:00:00.000Z");
    expect(localDateStringInTimezone(date, "Australia/Adelaide")).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("includes credit dates within billing period in student timezone", () => {
    const inPeriod = isCreditDateInBillingPeriod(
      "2026-06-10",
      "2026-06-01T00:00:00.000Z",
      "2026-06-30T23:59:59.000Z",
      "UTC",
    );
    expect(inPeriod).toBe(true);
  });

  it("excludes credit dates outside billing period", () => {
    const inPeriod = isCreditDateInBillingPeriod(
      "2026-05-31",
      "2026-06-01T00:00:00.000Z",
      "2026-06-30T23:59:59.000Z",
      "UTC",
    );
    expect(inPeriod).toBe(false);
  });
});
