import {
  getSupportedIanaTimeZones,
  isSupportedIanaTimeZone,
} from "@/lib/supported-timezones";

describe("supported timezones", () => {
  it("includes UTC even when Intl.supportedValuesOf omits aliases", () => {
    expect(getSupportedIanaTimeZones()).toContain("UTC");
  });

  it("accepts runtime-supported IANA names and aliases", () => {
    expect(isSupportedIanaTimeZone("Pacific/Chatham")).toBe(true);
    expect(isSupportedIanaTimeZone("UTC")).toBe(true);
  });

  it("rejects invalid timezone names", () => {
    expect(isSupportedIanaTimeZone("Not/A_Timezone")).toBe(false);
  });
});
