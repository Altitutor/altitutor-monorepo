/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, waitFor } from "@testing-library/react";
import { OnboardingGateRedirect } from "@/features/ucat-access/components/onboarding-gate-redirect";

const replace = jest.fn();
const usePathname = jest.fn(() => "/dashboard");
const useUcatAccess = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => usePathname(),
}));

jest.mock("@/features/ucat-access/hooks/use-ucat-access", () => ({
  useUcatAccess: () => useUcatAccess(),
}));

jest.mock("@/features/signup-onboarding/lib/signup-tour-flag", () => ({
  clearSignupJustCompleted: jest.fn(),
  isSignupJustCompleted: () => false,
}));

describe("OnboardingGateRedirect", () => {
  beforeEach(() => {
    replace.mockClear();
    usePathname.mockReturnValue("/dashboard");
  });

  it("redirects incomplete signups to /signup/complete once", async () => {
    useUcatAccess.mockReturnValue({
      isLoading: false,
      accessLoadFailed: false,
      signupCompleted: false,
    });

    const { rerender } = render(<OnboardingGateRedirect />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/signup/complete");
    });
    expect(replace).toHaveBeenCalledTimes(1);

    rerender(<OnboardingGateRedirect />);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("does not redirect when already on an allowed path", async () => {
    usePathname.mockReturnValue("/signup/complete");
    useUcatAccess.mockReturnValue({
      isLoading: false,
      accessLoadFailed: false,
      signupCompleted: false,
    });

    render(<OnboardingGateRedirect />);
    await waitFor(() => {
      expect(useUcatAccess).toHaveBeenCalled();
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
