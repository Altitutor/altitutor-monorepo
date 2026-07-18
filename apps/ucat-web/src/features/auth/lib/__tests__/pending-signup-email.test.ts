import {
  clearPendingSignupEmail,
  getPendingSignupEmail,
  savePendingSignupEmail,
} from "@/features/auth/lib/pending-signup-email";

describe("pending signup email", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.restoreAllMocks();
  });

  it("restores an email for the same signup context", () => {
    savePendingSignupEmail("student@example.com", "/subscribe\n");

    expect(getPendingSignupEmail("/subscribe\n")).toBe("student@example.com");
  });

  it("does not restore an email for a different signup context", () => {
    savePendingSignupEmail("student@example.com", "/subscribe\n");

    expect(getPendingSignupEmail("/checkout\n")).toBeNull();
  });

  it("removes an expired pending email", () => {
    const now = 2_000_000_000_000;
    jest.spyOn(Date, "now").mockReturnValue(now);
    savePendingSignupEmail("student@example.com", "/subscribe\n");
    jest.spyOn(Date, "now").mockReturnValue(now + 60 * 60 * 1000 + 1);

    expect(getPendingSignupEmail("/subscribe\n")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("clears only the matching signup context", () => {
    savePendingSignupEmail("student@example.com", "/subscribe\n");

    clearPendingSignupEmail("/checkout\n");
    expect(getPendingSignupEmail("/subscribe\n")).toBe("student@example.com");

    clearPendingSignupEmail("/subscribe\n");
    expect(getPendingSignupEmail("/subscribe\n")).toBeNull();
  });
});
