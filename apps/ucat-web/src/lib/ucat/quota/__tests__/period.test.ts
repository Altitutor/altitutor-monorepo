import { getQuotaPeriodStart } from "@/lib/ucat/quota/period";
import { getSupportedIanaTimeZones } from "@/lib/supported-timezones";

describe("getQuotaPeriodStart", () => {
  const timezone = "Australia/Adelaide";
  const mondayEvening = new Date("2026-06-22T11:30:00.000Z");

  it("returns the current local midnight for a daily quota", () => {
    expect(
      getQuotaPeriodStart("day", timezone, mondayEvening).toISOString(),
    ).toBe("2026-06-21T14:30:00.000Z");
  });

  it("returns local Monday midnight for a weekly quota", () => {
    expect(
      getQuotaPeriodStart("week", timezone, mondayEvening).toISOString(),
    ).toBe("2026-06-21T14:30:00.000Z");
  });

  it("returns local month start for a monthly quota", () => {
    expect(
      getQuotaPeriodStart("month", timezone, mondayEvening).toISOString(),
    ).toBe("2026-05-31T14:30:00.000Z");
  });

  it("uses Adelaide daylight-saving offset", () => {
    const summerEvening = new Date("2026-01-15T10:00:00.000Z");

    expect(
      getQuotaPeriodStart("day", timezone, summerEvening).toISOString(),
    ).toBe("2026-01-14T13:30:00.000Z");
  });

  it("handles zones where daylight saving starts at local midnight", () => {
    const havanaTransitionDay = new Date("2026-03-08T12:00:00.000Z");

    expect(
      getQuotaPeriodStart(
        "day",
        "America/Havana",
        havanaTransitionDay,
      ).toISOString(),
    ).toBe("2026-03-08T05:00:00.000Z");
  });

  it("handles timezone offset changes between UTC and local midnight", () => {
    const gazaTransitionDay = new Date("2026-03-28T12:00:00.000Z");

    expect(
      getQuotaPeriodStart("day", "Asia/Gaza", gazaTransitionDay).toISOString(),
    ).toBe("2026-03-27T22:00:00.000Z");
  });

  it("returns the correct local day boundary for every supported timezone", () => {
    const at = new Date("2026-06-22T12:00:00.000Z");

    for (const supportedTimezone of getSupportedIanaTimeZones()) {
      const expectedDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: supportedTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(at);
      const actual = new Intl.DateTimeFormat("en-CA", {
        timeZone: supportedTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(getQuotaPeriodStart("day", supportedTimezone, at));

      expect(actual).toBe(`${expectedDate}, 00:00`);
    }
  });
});
