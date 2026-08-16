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
      confirmedEmail="provider@example.com"
      initialFirstName="Taylor"
      initialLastName="Student"
      initialPhone=""
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
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ucat/signup/complete",
      expect.objectContaining({ method: "POST" }),
    );
    expect(subscribeToUcatNewsletter).toHaveBeenCalledWith(
      "ucat_social_signup",
    );
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "provider@example.com",
        pendingEmail: "",
      }),
    );
  });

  it("keeps the authenticated email read-only and never starts an email change", async () => {
    const { onComplete } = renderStep();
    const email = screen.getByLabelText("Email address");

    expect(email).toHaveValue("provider@example.com");
    expect(email).toHaveAttribute("readonly");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "provider@example.com",
        pendingEmail: "",
      }),
    );
  });
});
