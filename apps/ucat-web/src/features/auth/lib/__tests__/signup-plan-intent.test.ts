import {
  buildSignupCheckoutPath,
  parseSignupPlanIntent,
} from "@/features/auth/lib/signup-plan-intent";

describe("signup plan intent", () => {
  it("round-trips a paid plan selection into a safe checkout path", () => {
    const path = buildSignupCheckoutPath("unlimited", "year");

    expect(path).toBe(
      "/checkout?tier=unlimited&interval=year&context=signup_onboarding",
    );
    expect(parseSignupPlanIntent(path)).toEqual({
      tier: "unlimited",
      interval: "year",
      checkoutPath: path,
    });
  });

  it("rejects redirects that are not signup checkout intents", () => {
    expect(
      parseSignupPlanIntent("/checkout?tier=unlimited&interval=month"),
    ).toBeNull();
    expect(
      parseSignupPlanIntent(
        "/checkout?tier=free&interval=month&context=signup_onboarding",
      ),
    ).toBeNull();
    expect(parseSignupPlanIntent("https://example.com/checkout")).toBeNull();
  });
});
