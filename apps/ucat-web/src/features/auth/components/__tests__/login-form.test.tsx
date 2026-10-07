import React from "react";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { captureException } from "@sentry/nextjs";
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

jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

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

  it("enables credentials after client hydration", async () => {
    render(<LoginForm />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
    );
    expect(screen.getByLabelText("Email address")).not.toHaveAttribute(
      "readonly",
    );
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("readonly");
    expect(
      screen.getByRole("button", { name: "Sign in" }).closest("form"),
    ).toHaveAttribute("data-hydrated", "true");
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

  it.each(["Load failed", "Failed to fetch"])(
    "lets a student retry a returned auth transport failure: %s",
    async (message) => {
      signInWithPassword.mockResolvedValueOnce({
        data: { user: null, session: null },
        error: new AuthRetryableFetchError(message, 0),
      });
      render(<LoginForm initialEmail="student@example.com" />);
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "correct horse battery staple" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "We couldn’t connect to sign you in. Check your connection and try again.",
      );
      expect(
        screen.queryByText("Incorrect email or password."),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
      expect(screen.getByLabelText("Password")).toHaveValue(
        "correct horse battery staple",
      );
      expect(signInWithPassword).toHaveBeenCalledTimes(1);
      expect(navigateAfterAuth).not.toHaveBeenCalled();
      expect(getLastSignInMethod()).toBeNull();
      expect(hasPasswordAuthHandoff("student-user")).toBe(false);

      fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
      await waitFor(() => expect(navigateAfterAuth).toHaveBeenCalledTimes(1));
      expect(signInWithPassword).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  it("restores the form after a rejected sign-in request", async () => {
    signInWithPassword.mockRejectedValueOnce(
      new AuthRetryableFetchError("Failed to fetch", 0),
    );
    render(<LoginForm initialEmail="student@example.com" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct horse battery staple" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t connect to sign you in. Check your connection and try again.",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(navigateAfterAuth).not.toHaveBeenCalled();
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
  });

  it("does not blame credentials or connectivity for a retryable Auth outage", async () => {
    signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: new AuthRetryableFetchError("Service unavailable", 503),
    });
    render(<LoginForm initialEmail="student@example.com" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Sign-in is temporarily unavailable. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(navigateAfterAuth).not.toHaveBeenCalled();
  });

  it("reports unexpected rejected requests and restores retry controls", async () => {
    const failure = new Error("Unexpected SDK failure");
    signInWithPassword.mockRejectedValueOnce(failure);
    render(<LoginForm initialEmail="student@example.com" />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "correct password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t sign you in. Please try again.",
    );
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
    expect(captureException).toHaveBeenCalledWith(failure);
    expect(navigateAfterAuth).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Unexpected SDK failure"),
    ).not.toBeInTheDocument();
  });

  it("keeps password failures generic", async () => {
    signInWithPassword.mockResolvedValue({
      error: new AuthApiError(
        "User not found in auth.users",
        400,
        "invalid_credentials",
      ),
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
