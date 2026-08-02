import {
  authEntryPath,
  campaignProperties,
  copyCampaignQueryParams,
  pathWithReturnIntent,
  safeInternalPath,
  safePostAuthReturnPath,
} from "@/features/auth/lib/return-intent";

describe("return intent", () => {
  it("preserves an application path, query string and hash", () => {
    expect(
      safePostAuthReturnPath(
        "/study-plan?utm_source=altitutor&utm_medium=email#today",
      ),
    ).toBe("/study-plan?utm_source=altitutor&utm_medium=email#today");
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "/login",
    "/auth/callback",
    "/api/ucat/profile",
    "/_next/static/chunk.js",
  ])("rejects unsafe or non-application destination %s", (value) => {
    expect(safePostAuthReturnPath(value)).toBe("/dashboard");
  });

  it("allows onboarding routes only for trusted internal navigation", () => {
    expect(
      safeInternalPath("/signup/complete?redirect=%2Fstudy-plan", "/fallback"),
    ).toBe("/signup/complete?redirect=%2Fstudy-plan");
  });

  it("adds a non-default return intent without losing existing parameters", () => {
    expect(
      pathWithReturnIntent("/signup/complete/sampler", "/study-plan?week=2", {
        afterPlan: "1",
        activation: "1",
      }),
    ).toBe(
      "/signup/complete/sampler?afterPlan=1&activation=1&redirect=%2Fstudy-plan%3Fweek%3D2",
    );
    expect(pathWithReturnIntent("/signup/complete", "/dashboard")).toBe(
      "/signup/complete",
    );
  });

  it("copies only bounded standard campaign parameters", () => {
    const source = new URLSearchParams({
      utm_source: "altitutor",
      utm_medium: "email",
      utm_campaign: "ucat_weekly_progress",
      token: "do-not-copy",
    });
    const destination = new URLSearchParams();

    copyCampaignQueryParams(source, destination);

    expect(Object.fromEntries(destination)).toEqual({
      utm_source: "altitutor",
      utm_medium: "email",
      utm_campaign: "ucat_weekly_progress",
    });
    expect(campaignProperties(source)).toEqual({
      utm_source: "altitutor",
      utm_medium: "email",
      utm_campaign: "ucat_weekly_progress",
    });
  });

  it("builds an auth entry that preserves route intent and exposes attribution", () => {
    const requested =
      "/study-plan?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_onboarding_plan";
    const source = new URL(requested, "https://ucat.altitutor.com");

    expect(authEntryPath("/login", requested, source.searchParams)).toBe(
      "/login?redirect=%2Fstudy-plan%3Futm_source%3Daltitutor%26utm_medium%3Demail%26utm_campaign%3Ducat_onboarding_plan&utm_source=altitutor&utm_medium=email&utm_campaign=ucat_onboarding_plan",
    );
  });
});
