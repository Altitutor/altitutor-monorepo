import { formatDashboardTestCountdown } from "../dashboard-test-countdown";

describe("formatDashboardTestCountdown", () => {
  it.each([
    [null, null],
    [0, "Your UCAT test is today"],
    [1, "1 day until your UCAT test"],
    [80, "80 days until your UCAT test"],
  ])("formats test day %s as %s", (testDay, expected) => {
    expect(formatDashboardTestCountdown(testDay)).toBe(expected);
  });
});
