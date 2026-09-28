import React from "react";
import { render, screen } from "@testing-library/react";
import { AuthGuard } from "../AuthGuard";

Object.assign(globalThis, { React });

const mockReplace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/login",
}));
jest.mock("@altitutor/shared/hooks", () => ({
  useAuthSessionRecovery: jest.fn(),
}));
jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "stale-browser-user" }, loading: false }),
}));

beforeEach(() => {
  mockReplace.mockClear();
});

it("keeps a server-redirected native handoff on the login page despite a stale browser user", () => {
  window.history.replaceState({}, "", "/login?next=%2Fmobile-auth%3Fstate%3Dtest");
  render(
    <AuthGuard>
      <div>Sign in to continue</div>
    </AuthGuard>,
  );

  expect(screen.getByText("Sign in to continue")).toBeVisible();
  expect(mockReplace).not.toHaveBeenCalled();
});
