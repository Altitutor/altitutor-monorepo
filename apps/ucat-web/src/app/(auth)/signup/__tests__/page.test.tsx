import React from "react";
import { render, screen } from "@testing-library/react";
import SignupPage from "../page";
import { loadUcatPortalAccess } from "@/features/auth/server/portal-access";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

jest.mock("@/features/auth", () => ({
  SignupForm: ({ redirectTo }: { redirectTo: string }) => (
    <div data-testid="signup" data-return-to={redirectTo}>
      Create an account
    </div>
  ),
}));
jest.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: jest.fn(),
}));
jest.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: null }));
jest.mock("@/lib/ucat/referrals/capture-referral", () => ({
  captureUcatReferral: jest.fn(),
  resolveUcatReferralOfferPreview: jest.fn().mockResolvedValue(null),
}));
jest.mock("@/features/auth/lib/social-auth", () => ({
  getEnabledSocialAuthProviders: () => [],
}));
jest.mock("@/features/auth/components/portal-access-unavailable", () => ({
  PortalAccessUnavailable: () => null,
}));
jest.mock("@/features/auth/server/portal-access", () => ({
  loadUcatPortalAccess: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((path: string) => {
    throw new Error(path);
  }),
}));
const returnTo =
  "/mobile-auth?callback=altitutor-ucat%3A%2F%2Fauth-return&state=proof&challenge=challenge";
describe("signup entry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(getSupabaseServerClient)
      .mockResolvedValue({
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: "user" } }, error: null }),
        },
      } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
  });
  it("renders account creation for anonymous native entries, preserving the return", async () => {
    jest
      .mocked(loadUcatPortalAccess)
      .mockResolvedValue({ status: "unauthenticated" });
    render(
      await SignupPage({
        searchParams: Promise.resolve({ redirect: returnTo }),
      }),
    );
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(screen.getByTestId("signup")).toHaveAttribute(
      "data-return-to",
      returnTo,
    );
    expect(redirect).not.toHaveBeenCalled();
  });
  it("opens signup when a native logout left stale browser claims", async () => {
    jest
      .mocked(loadUcatPortalAccess)
      .mockResolvedValue({
        status: "allowed",
        userId: "user",
        access: { signupCompleted: true, activeStaffRole: null },
      } as Awaited<ReturnType<typeof loadUcatPortalAccess>>);
    jest
      .mocked(getSupabaseServerClient)
      .mockResolvedValue({
        auth: {
          getUser: jest
            .fn()
            .mockResolvedValue({
              data: { user: null },
              error: { message: "Session revoked" },
            }),
        },
      } as unknown as Awaited<ReturnType<typeof getSupabaseServerClient>>);
    render(
      await SignupPage({
        searchParams: Promise.resolve({ redirect: returnTo }),
      }),
    );
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("respects explicit native account creation despite an existing completed browser account", async () => {
    jest
      .mocked(loadUcatPortalAccess)
      .mockResolvedValue({
        status: "allowed",
        userId: "user",
        access: { signupCompleted: true, activeStaffRole: null },
      } as Awaited<ReturnType<typeof loadUcatPortalAccess>>);
    render(
      await SignupPage({
        searchParams: Promise.resolve({ redirect: returnTo }),
      }),
    );
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("keeps native return intent through existing incomplete account onboarding", async () => {
    jest.mocked(loadUcatPortalAccess).mockResolvedValue({
      status: "allowed",
      userId: "user",
      access: { signupCompleted: false, activeStaffRole: null },
    } as Awaited<ReturnType<typeof loadUcatPortalAccess>>);
    await expect(
      SignupPage({ searchParams: Promise.resolve({ redirect: returnTo }) }),
    ).rejects.toThrow("/signup/complete?");
    const path = jest.mocked(redirect).mock.calls[0]![0];
    expect(
      new URL(path, "https://test.invalid").searchParams.get("redirect"),
    ).toBe(returnTo);
  });
  it("keeps ordinary web signup on its default dashboard destination", async () => {
    jest.mocked(loadUcatPortalAccess).mockResolvedValue({
      status: "allowed",
      userId: "user",
      access: { signupCompleted: true, activeStaffRole: null },
    } as Awaited<ReturnType<typeof loadUcatPortalAccess>>);
    await expect(
      SignupPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("/dashboard");
  });
});
