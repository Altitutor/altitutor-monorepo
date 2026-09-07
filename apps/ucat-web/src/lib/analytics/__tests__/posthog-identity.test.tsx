import React from "react";
import { render } from "@testing-library/react";
import { UcatPostHogIdentity } from "@/lib/analytics/posthog-provider";

let pathname = "/login";
const mockUseUcatAccess = jest.fn(() => ({
  analyticsAccountClass: "external",
  isLoading: false,
  testDate: null,
  testYear: null,
}));

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/features/auth", () => ({
  useAuth: () => ({ isLoading: false, user: null }),
}));
jest.mock("@/features/ucat-access/hooks/use-ucat-access", () => ({
  useUcatAccess: () => mockUseUcatAccess(),
}));
jest.mock("posthog-js/react", () => ({
  PostHogProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("@/lib/analytics/posthog", () => ({
  getUcatAnalyticsSurface: (currentPathname: string) =>
    currentPathname.startsWith("/login") ||
    currentPathname.startsWith("/signup") ||
    currentPathname.startsWith("/forgot-password") ||
    currentPathname.startsWith("/reset-password")
      ? "auth"
      : "application",
  posthog: {
    __loaded: false,
    capture: jest.fn(),
    identify: jest.fn(),
    init: jest.fn(),
    register: jest.fn(),
    reset: jest.fn(),
  },
  UCAT_ANALYTICS_CONTEXT: { app: "ucat-web", product: "ucat" },
}));

describe("UcatPostHogIdentity", () => {
  beforeEach(() => {
    pathname = "/login";
    mockUseUcatAccess.mockClear();
  });

  it.each(["/login", "/signup", "/auth/callback"])(
    "does not request protected access while leaving %s",
    (authPath) => {
      pathname = authPath;

      render(<UcatPostHogIdentity />);

      expect(mockUseUcatAccess).not.toHaveBeenCalled();
    },
  );

  it("loads access identity on application pages", () => {
    pathname = "/dashboard";

    render(<UcatPostHogIdentity />);

    expect(mockUseUcatAccess).toHaveBeenCalledTimes(1);
  });
});
