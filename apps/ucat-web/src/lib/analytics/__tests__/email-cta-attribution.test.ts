import { buildEmailCtaLandingAttribution } from "@/lib/analytics/email-cta-attribution";

describe("email CTA attribution", () => {
  it("attributes an auth-gated landing to its intended application route", () => {
    const attribution = buildEmailCtaLandingAttribution(
      "/login",
      new URLSearchParams({
        redirect:
          "/study-plan?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_onboarding_plan",
        utm_source: "altitutor",
        utm_medium: "email",
        utm_campaign: "ucat_onboarding_plan",
        utm_content: "primary_cta",
      }),
    );

    expect(attribution?.properties).toEqual({
      utm_source: "altitutor",
      utm_medium: "email",
      utm_campaign: "ucat_onboarding_plan",
      utm_content: "primary_cta",
      landing_path: "/login",
      intended_destination: "/study-plan",
    });
  });

  it("attributes an already-authenticated landing directly", () => {
    expect(
      buildEmailCtaLandingAttribution(
        "/progress",
        new URLSearchParams({
          utm_source: "altitutor",
          utm_medium: "email",
          utm_campaign: "ucat_weekly_progress",
        }),
      )?.properties.intended_destination,
    ).toBe("/progress");
  });

  it("ignores non-email campaigns", () => {
    expect(
      buildEmailCtaLandingAttribution(
        "/study-plan",
        new URLSearchParams({ utm_medium: "social" }),
      ),
    ).toBeNull();
  });
});
