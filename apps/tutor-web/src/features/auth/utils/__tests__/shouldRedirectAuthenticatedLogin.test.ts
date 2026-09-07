import { shouldRedirectAuthenticatedLogin } from "../shouldRedirectAuthenticatedLogin";

describe("shouldRedirectAuthenticatedLogin", () => {
  it("does not bounce a signed-in tutor off login when portal access was denied", () => {
    expect(shouldRedirectAuthenticatedLogin("/login", true)).toBe(false);
  });

  it("still sends an authenticated tutor away from a normal login visit", () => {
    expect(shouldRedirectAuthenticatedLogin("/login", false)).toBe(true);
  });
});
