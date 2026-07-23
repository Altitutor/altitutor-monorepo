import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SocialAuthButtons } from "@/features/auth/components/social-auth-buttons";
import { captureUcatEvent } from "@/lib/analytics/posthog";

const signInWithOAuth = jest.fn();

jest.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOAuth },
  }),
}));

jest.mock("@/lib/analytics/posthog", () => ({
  captureUcatEvent: jest.fn(),
}));

describe("SocialAuthButtons", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("starts Google signup with callback context and analytics", async () => {
    render(
      <SocialAuthButtons
        enabledProviders={["google"]}
        intent="signup"
        redirectTo="/subscribe"
        newsletterOptIn
        referralCode="ABCD1234"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Google" }),
    );

    await waitFor(() => expect(signInWithOAuth).toHaveBeenCalledTimes(1));
    const credentials = signInWithOAuth.mock.calls[0][0];
    expect(credentials.provider).toBe("google");
    const callback = new URL(credentials.options.redirectTo);
    expect(callback.searchParams.get("intent")).toBe("signup");
    expect(callback.searchParams.get("newsletter")).toBe("1");
    expect(callback.searchParams.get("ref")).toBe("ABCD1234");
    expect(captureUcatEvent).toHaveBeenCalledWith("signup_started", {
      auth_provider: "google",
      referral_present: true,
      newsletter_opt_in: true,
    });
  });

  it("shows OAuth errors without navigating away", async () => {
    signInWithOAuth.mockResolvedValue({
      error: { message: "Provider unavailable" },
    });
    render(
      <SocialAuthButtons
        enabledProviders={["apple"]}
        intent="login"
        redirectTo="/dashboard"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with Apple" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Provider unavailable",
    );
  });
});
