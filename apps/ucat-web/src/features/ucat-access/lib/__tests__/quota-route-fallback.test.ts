import { quotaRouteFallback } from "@/features/ucat-access/lib/quota-route-fallback";

describe("quotaRouteFallback", () => {
  it.each([
    ["learn", "/learn", "Back to learning modules"],
    ["practice", "/practice", "Back to practice"],
    ["sets", "/sets", "Back to sets"],
    ["mocks", "/mocks", "Back to mocks"],
    ["skill_trainer", "/skill-trainer", "Back to skill trainer"],
  ] as const)("maps %s to its safe browsing route", (area, href, label) => {
    expect(quotaRouteFallback(area)).toEqual({ href, label });
  });
});
