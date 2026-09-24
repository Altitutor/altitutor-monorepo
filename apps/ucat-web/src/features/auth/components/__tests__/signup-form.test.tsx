import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignupForm } from "@/features/auth/components/signup-form";
import { savePendingSignupEmail } from "@/features/auth/lib/pending-signup-email";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";
import { takePendingLoginEmail } from "@/features/auth/lib/pending-login-email";

const signInWithOtp = jest.fn();
const verifyOtp = jest.fn();

jest.mock("@/features/auth/lib/navigate-after-auth", () => ({
  navigateAfterAuth: jest.fn(),
}));

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOtp, verifyOtp },
  }),
}));

jest.mock("@/lib/analytics/posthog", () => ({
  captureUcatEvent: jest.fn(),
}));

jest.mock("@/features/auth/components/auth-page-header", () => ({
  AuthPageHeader: ({ onBack }: { onBack?: () => void }) =>
    onBack ? (
      <button type="button" onClick={onBack}>
        Back
      </button>
    ) : null,
}));

describe("SignupForm", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    jest.clearAllMocks();
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ error: null }),
    });
  });

  it("shows the email notice and does not render a marketing checkbox", async () => {
    render(<SignupForm />);

    expect(
      screen.getByText(
        /We'll send you personalised progress updates and occasional preparation tips by email/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "Existing@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "existing@example.com",
        options: expect.objectContaining({ shouldCreateUser: true }),
      }),
    );
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(screen.getByText("existing@example.com")).toBeInTheDocument();
  });

  it("sends an existing confirmed account to password login without an OTP", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: "confirmed" }),
    });

    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "Existing@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(navigateAfterAuth).toHaveBeenCalledWith("/login?existing=1"),
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(takePendingLoginEmail()).toBe("existing@example.com");
  });

  it("resumes OTP signup when no confirmed account is disclosed", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: "available" }),
    });

    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "unfinished@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "unfinished@example.com" }),
    );
    expect(navigateAfterAuth).not.toHaveBeenCalled();
  });

  it("stops signup when account discovery is rate-limited", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({
        error: "Too many attempts. Please try again shortly.",
      }),
    });

    render(<SignupForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "student@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Too many attempts. Please try again shortly.",
    );
    expect(signInWithOtp).not.toHaveBeenCalled();
    expect(navigateAfterAuth).not.toHaveBeenCalled();
  });

  it("opts the student into lifecycle email after OTP verification", async () => {
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "Student@Example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    const otpInput = await screen.findByLabelText("6-digit code");
    fireEvent.change(otpInput, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue with code" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/ucat/newsletter/subscribe",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ source: "ucat_email_signup" }),
        }),
      ),
    );
  });

  it("establishes the OTP session on the server before navigating to signup complete", async () => {
    savePendingSignupEmail("student@example.com", "/dashboard\n");

    render(<SignupForm />);

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with code" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/verify-otp",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "student@example.com",
            token: "123456",
          }),
        }),
      );
    });
    expect(verifyOtp).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
    expect(navigateAfterAuth).toHaveBeenCalledWith(
      "/auth/continue?intent=signup&next=%2Fdashboard",
    );
  });

  it("defers a protected return intent until signup onboarding is complete", async () => {
    const redirectTo =
      "/study-plan?utm_source=altitutor&utm_medium=email&utm_campaign=ucat_onboarding_plan";
    savePendingSignupEmail("student@example.com", `${redirectTo}\n`);

    render(<SignupForm redirectTo={redirectTo} />);
    fireEvent.change(await screen.findByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with code" }));

    await waitFor(() =>
      expect(navigateAfterAuth).toHaveBeenCalledWith(
        "/auth/continue?intent=signup&next=%2Fstudy-plan%3Futm_source%3Daltitutor%26utm_medium%3Demail%26utm_campaign%3Ducat_onboarding_plan",
      ),
    );
  });

  it("stays on code entry when the server cannot establish a session", async () => {
    savePendingSignupEmail("student@example.com", "/dashboard\n");
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          message:
            "The code was accepted, but no signup session was created. Please request a new code.",
          status: 401,
          code: "signup_session_missing",
        },
      }),
    });

    render(<SignupForm />);
    fireEvent.change(await screen.findByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with code" }));

    expect(
      await screen.findByText(/no signup session was created/i),
    ).toBeInTheDocument();
    expect(navigateAfterAuth).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Continue with code" }),
    ).toBeEnabled();
  });
});
