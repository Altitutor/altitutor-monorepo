import {
  getQuotaAreaForPathname,
  isSkillTrainerPlayRoute,
} from "@/features/ucat-access/lib/quota-area-for-pathname";

describe("getQuotaAreaForPathname", () => {
  it("maps practice browsing and result routes", () => {
    expect(getQuotaAreaForPathname("/practice")).toBe("practice");
    expect(getQuotaAreaForPathname("/progress/practice-sessions/abc")).toBe(
      "practice",
    );
  });

  it("maps sets browsing routes and subpages", () => {
    expect(getQuotaAreaForPathname("/sets")).toBe("sets");
    expect(getQuotaAreaForPathname("/sets/sections/1")).toBe("sets");
    expect(getQuotaAreaForPathname("/sets/sections/1/set-id")).toBe("sets");
    expect(getQuotaAreaForPathname("/progress/set-attempts/abc")).toBe("sets");
    expect(
      getQuotaAreaForPathname("/progress/sections/2/set-attempts/abc"),
    ).toBe("sets");
    expect(getQuotaAreaForPathname("/sessions/session-id/sets/set-id")).toBe(
      "sets",
    );
  });

  it("excludes the unified active exam route", () => {
    expect(getQuotaAreaForPathname("/exam")).toBeNull();
  });

  it("maps mocks browsing routes and subpages", () => {
    expect(getQuotaAreaForPathname("/mocks")).toBe("mocks");
    expect(getQuotaAreaForPathname("/mocks/mock-id")).toBe("mocks");
    expect(getQuotaAreaForPathname("/progress/mocks")).toBe("mocks");
    expect(getQuotaAreaForPathname("/progress/mocks/mock-attempts/abc")).toBe(
      "mocks",
    );
    expect(getQuotaAreaForPathname("/sessions/session-id/mocks/mock-id")).toBe(
      "mocks",
    );
  });

  it("maps learn browsing routes", () => {
    expect(getQuotaAreaForPathname("/learn")).toBe("learn");
    expect(getQuotaAreaForPathname("/learn/module-id")).toBe("learn");
  });

  it("maps skill trainer browsing routes but not active play routes", () => {
    expect(getQuotaAreaForPathname("/skill-trainer")).toBe("skill_trainer");
    expect(getQuotaAreaForPathname("/skill-trainer/arithmetic")).toBe(
      "skill_trainer",
    );
    expect(
      getQuotaAreaForPathname("/skill-trainer/arithmetic/play"),
    ).toBeNull();
    expect(isSkillTrainerPlayRoute("/skill-trainer/arithmetic/play")).toBe(
      true,
    );
  });

  it("returns null for unrelated routes", () => {
    expect(getQuotaAreaForPathname("/dashboard")).toBeNull();
    expect(getQuotaAreaForPathname("/progress")).toBeNull();
    expect(getQuotaAreaForPathname("/settings/subscription")).toBeNull();
  });
});
