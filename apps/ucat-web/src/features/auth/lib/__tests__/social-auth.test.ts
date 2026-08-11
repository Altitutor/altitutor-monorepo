import {
  buildSocialAuthCallbackUrl,
  getEnabledSocialAuthProviders,
  normalizeReferralCode,
  parseSocialAuthIntent,
  resolvePostAuthDestination,
} from "@/features/auth/lib/social-auth";

describe("social auth", () => {
  it("enables providers only when their server flag is explicitly true", () => {
    expect(
      getEnabledSocialAuthProviders({
        AUTH_GOOGLE_ENABLED: "true",
        AUTH_APPLE_ENABLED: "0",
      }),
    ).toEqual(["google"]);
    expect(
      getEnabledSocialAuthProviders({
        AUTH_GOOGLE_ENABLED: "1",
        AUTH_APPLE_ENABLED: "TRUE",
      }),
    ).toEqual(["google", "apple"]);
  });

  it("builds a signup callback that preserves a validated referral", () => {
    const callback = new URL(
      buildSocialAuthCallbackUrl({
        origin: "https://ucat.altitutor.com",
        intent: "signup",
        provider: "google",
        next: "/checkout?tier=unlimited&interval=month&context=signup_onboarding",
        referralCode: " abcd1234 ",
      }),
    );

    expect(callback.origin).toBe("https://ucat.altitutor.com");
    expect(callback.pathname).toBe("/auth/callback");
    expect(Object.fromEntries(callback.searchParams)).toEqual({
      intent: "signup",
      provider: "google",
      next: "/checkout?tier=unlimited&interval=month&context=signup_onboarding",
      ref: "ABCD1234",
    });
  });

  it("does not put signup-only state on login or link callbacks", () => {
    const callback = new URL(
      buildSocialAuthCallbackUrl({
        origin: "https://ucat.altitutor.com",
        intent: "link",
        provider: "apple",
        next: "/settings/profile",
        referralCode: "ABCD1234",
      }),
    );

    expect(callback.searchParams.has("newsletter")).toBe(false);
    expect(callback.searchParams.has("ref")).toBe(false);
  });

  it("routes incomplete users into signup onboarding while preserving paid intent", () => {
    expect(
      resolvePostAuthDestination({
        intent: "signup",
        provider: "google",
        next: "/checkout?tier=unlimited&interval=month&context=signup_onboarding",
        signupCompleted: false,
      }),
    ).toBe(
      "/signup/complete?redirect=%2Fcheckout%3Ftier%3Dunlimited%26interval%3Dmonth%26context%3Dsignup_onboarding",
    );
    expect(
      resolvePostAuthDestination({
        intent: "login",
        provider: "google",
        next: "/dashboard",
        signupCompleted: false,
      }),
    ).toBe("/signup/complete");
    expect(
      resolvePostAuthDestination({
        intent: "login",
        provider: "google",
        next: "/study-plan?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_onboarding_plan",
        signupCompleted: false,
      }),
    ).toBe(
      "/signup/complete?redirect=%2Fstudy-plan%3Futm_source%3Daltitutor%26utm_medium%3Demail%26utm_campaign%3Ducat_onboarding_plan",
    );
  });

  it("returns completed and linking users to their intended destinations", () => {
    expect(
      resolvePostAuthDestination({
        intent: "login",
        provider: "google",
        next: "/practice",
        signupCompleted: true,
      }),
    ).toBe("/practice");
    expect(
      resolvePostAuthDestination({
        intent: "link",
        provider: "apple",
        next: "/dashboard",
        signupCompleted: true,
      }),
    ).toBe("/settings/profile?linked=1&provider=apple");
  });

  it("normalizes only supported intent and referral values", () => {
    expect(parseSocialAuthIntent("link")).toBe("link");
    expect(parseSocialAuthIntent("unexpected")).toBe("login");
    expect(normalizeReferralCode("abcd1234")).toBe("ABCD1234");
    expect(normalizeReferralCode("not valid")).toBeNull();
  });

  it("does not place an unsafe return destination in an OAuth callback", () => {
    const callback = new URL(
      buildSocialAuthCallbackUrl({
        origin: "https://ucat.altitutor.com",
        intent: "login",
        provider: "google",
        next: "//evil.example/path",
      }),
    );

    expect(callback.searchParams.get("next")).toBe("/dashboard");
  });
});
