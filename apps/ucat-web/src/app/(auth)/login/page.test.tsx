/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { redirect } from "next/navigation";
import LoginPage from "@/app/(auth)/login/page";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

jest.mock("@/features/auth", () => ({
  LoginForm: ({ redirectTo }: { redirectTo: string }) => (
    <div data-testid="login-form" data-redirect-to={redirectTo} />
  ),
  LoginPageLayout: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/features/auth/lib/social-auth", () => ({
  getEnabledSocialAuthProviders: () => [],
}));

jest.mock("@/features/auth/server/portal-access", () => ({
  loadUcatPortalAccess: jest.fn(),
}));

const mockRedirect = jest.mocked(redirect);
const mockLoadUcatPortalAccess = jest.mocked(loadUcatPortalAccess);

describe("LoginPage", () => {
  beforeEach(() => {
    mockRedirect.mockReset();
    mockRedirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    mockLoadUcatPortalAccess.mockReset();
  });

  it("remains on login when a previous account session is present", async () => {
    render(
      await LoginPage({
        searchParams: Promise.resolve({ redirect: "/dashboard" }),
      }),
    );

    expect(screen.getByTestId("login-form")).toHaveAttribute(
      "data-redirect-to",
      "/dashboard",
    );
    expect(mockLoadUcatPortalAccess).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
