import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";

describe("navigateAfterAuth", () => {
  const assign = jest.fn();

  beforeEach(() => {
    assign.mockClear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, assign },
    });
  });

  it("assigns same-origin relative paths", () => {
    navigateAfterAuth("/signup/complete");
    expect(assign).toHaveBeenCalledWith("/signup/complete");
  });

  it("rejects open redirects", () => {
    navigateAfterAuth("https://evil.example");
    expect(assign).toHaveBeenCalledWith("/signup/complete");
  });
});
