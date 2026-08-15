import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm } from "@/features/auth/components/login-form";
import { savePendingLoginEmail } from "@/features/auth/lib/pending-login-email";
import {
  getLastSignInMethod,
  rememberLastSignInMethod,
} from "@/features/auth/lib/last-sign-in-method";
import { hasPasswordAuthHandoff } from "@/features/auth/lib/password-auth-handoff";

const signInWithPassword = jest.fn();
const navigateAfterAuth = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithPassword },
  }),
}));

jest.mock("@/features/auth/lib/navigate-after-auth", () => ({
  navigateAfterAuth: (path: string) => navigateAfterAuth(path),
}));

jest.mock("@/features/auth/components/social-auth-buttons", () => ({
  SocialAuthButtons: () => null,
  SocialAuthDivider: () => null,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    jest.clearAllMocks();
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "student-user" } },
      error: null,
    });
  });

  it("marks password as the last method used on this browser", () => {
    rememberLastSignInMethod("password");

    render(<LoginForm />);

    expect(screen.getByText("Last used")).toBeInTheDocument();
  });

  it("prefills a signup handoff email and focuses password", () => {
    savePendingLoginEmail("existing@example.com");

    render(<LoginForm accountExists />);

    expect(screen.getByLabelText("Email address")).toHaveValue(
      "existing@example.com",
    );
    expect(screen.getByLabelText("Password")).toHaveFocus();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("continues through server-side account routing after password authentication", async () => {
    render(<LoginForm initialEmail="student@example.com" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() =>
      expect(navigateAfterAuth).toHaveBeenCalledWith(
        "/auth/continue?intent=login&next=%2Fdashboard",
      ),
    );
    expect(getLastSignInMethod()).toBe("password");
    expect(hasPasswordAuthHandoff("student-user")).toBe(true);
  });

  it("keeps password failures generic", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "User not found in auth.users" },
    });
    render(<LoginForm initialEmail="unknown@example.com" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "incorrect" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect email or password.",
    );
    expect(screen.queryByText(/auth\.users/i)).not.toBeInTheDocument();
  });
});
