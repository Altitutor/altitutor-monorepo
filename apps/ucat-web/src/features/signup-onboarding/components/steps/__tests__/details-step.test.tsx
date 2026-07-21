import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignupCompleteDetailsStep } from "@/features/signup-onboarding/components/steps/details-step";
import { subscribeToUcatNewsletter } from "@/features/auth/api/newsletter";

jest.mock("@altitutor/ui", () => ({
  PhoneInput: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
  }) => (
    <input
      aria-label="Phone"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    />
  ),
  isPhoneCountryCodeOnly: () => false,
  validateOptionalPhoneE164: () => ({ phone: null, error: null }),
}));

jest.mock("@/features/auth/api/newsletter", () => ({
  subscribeToUcatNewsletter: jest.fn().mockResolvedValue(undefined),
}));

const updateUser = jest.fn();
const fetchMock = jest.fn();

function renderStep({
  onComplete = jest.fn(),
  setError = jest.fn(),
}: {
  onComplete?: jest.Mock;
  setError?: jest.Mock;
} = {}) {
  render(
    <SignupCompleteDetailsStep
      supabase={{ auth: { updateUser } } as never}
      confirmedEmail="provider@example.com"
      initialEmail="provider@example.com"
      pendingEmail=""
      initialFirstName="Taylor"
      initialLastName="Student"
      initialPhone=""
      newsletterOptIn
      onComplete={onComplete}
      error={null}
      setError={setError}
    />,
  );
  return { onComplete, setError };
}

describe("SignupCompleteDetailsStep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updateUser.mockResolvedValue({ error: null });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock;
  });

  it("renders the primary action as a filled animated pill", () => {
    renderStep();

    expect(screen.getByRole("button", { name: "Next" })).toHaveClass(
      "ucat-btn-accent-fill-rise",
      "rounded-full",
      "bg-primary",
      "py-3.5",
      "text-primary-foreground",
    );
  });

  it("keeps the verified provider email without another verification request", async () => {
    const { onComplete } = renderStep();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(updateUser).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ucat/signup/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(subscribeToUcatNewsletter).toHaveBeenCalledWith(
      "provider@example.com",
      "ucat_social_signup",
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "provider@example.com",
        pendingEmail: "",
      }),
    );
  });

  it("requests a confirmed Auth email change while retaining social sign-in", async () => {
    const { onComplete } = renderStep();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "chosen@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledTimes(1));
    expect(updateUser).toHaveBeenCalledWith(
      { email: "chosen@example.com" },
      {
        emailRedirectTo:
          "http://localhost/auth/callback?next=%2Fsignup%2Fcomplete",
      },
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "chosen@example.com",
        pendingEmail: "chosen@example.com",
      }),
    );
  });

  it("does not save profile details when the Auth email change fails", async () => {
    updateUser.mockResolvedValue({
      error: { message: "Email address is already in use" },
    });
    const { onComplete, setError } = renderStep();
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "taken@example.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(setError).toHaveBeenCalledWith("Email address is already in use"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });
});
