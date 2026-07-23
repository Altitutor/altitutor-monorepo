import { isAllowedBeforeSignupComplete } from "@/features/signup-onboarding/lib/signup-complete-paths";

describe("isAllowedBeforeSignupComplete", () => {
  it("allows signup onboarding and checkout routes", () => {
    expect(isAllowedBeforeSignupComplete("/signup/complete")).toBe(true);
    expect(isAllowedBeforeSignupComplete("/signup/complete/sampler")).toBe(
      true,
    );
    expect(isAllowedBeforeSignupComplete("/checkout")).toBe(true);
  });

  it("blocks app routes that require a student profile", () => {
    expect(isAllowedBeforeSignupComplete("/dashboard")).toBe(false);
    expect(isAllowedBeforeSignupComplete("/subscribe")).toBe(false);
    expect(isAllowedBeforeSignupComplete("/settings/plan")).toBe(false);
    expect(isAllowedBeforeSignupComplete("/signup")).toBe(false);
  });
});
