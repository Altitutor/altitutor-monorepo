import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignupForm } from "@/features/auth/components/signup-form";
import { savePendingSignupEmail } from "@/features/auth/lib/pending-signup-email";

const push = jest.fn();
const refresh = jest.fn();
const signInWithOtp = jest.fn();
const verifyOtp = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
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
    global.fetch = jest.fn();
  });

  it("sends an OTP without preflighting whether the account exists", async () => {
    render(<SignupForm />);

    expect(
      screen.getByLabelText(/Email me optional personalised progress/i),
    ).not.toBeChecked();

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
    expect(global.fetch).not.toHaveBeenCalled();
    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(screen.getByText("existing@example.com")).toBeInTheDocument();
  });

  it("subscribes only when the student explicitly opts in", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    render(<SignupForm />);

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "Student@Example.com" },
    });
    fireEvent.click(
      screen.getByLabelText(/Email me optional personalised progress/i),
    );
    fireEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(global.fetch).not.toHaveBeenCalled();
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

  it("restores the code-entry screen after a reload and clears it on success", async () => {
    savePendingSignupEmail("student@example.com", "/subscribe\n");

    render(<SignupForm />);

    expect(await screen.findByText("Check your inbox")).toBeInTheDocument();
    expect(signInWithOtp).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText("000000"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue with code" }));

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "student@example.com",
        token: "123456",
        type: "email",
      }),
    );
    expect(window.sessionStorage.length).toBe(0);
    expect(push).toHaveBeenCalledWith("/signup/complete");
  });
});
