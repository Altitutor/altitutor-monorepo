import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { PlanPickerCta } from "../plan-picker-cta";

jest.mock("@/features/landing/components/marketing/magnetic-button", () => ({
  MagneticButton: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => <button {...props}>{children}</button>,
}));

describe("PlanPickerCta", () => {
  it("allows an onboarding student to continue with their current paid plan", () => {
    const onClick = jest.fn();

    render(
      <PlanPickerCta
        variant="proAccent"
        surfaceTheme="app"
        isCurrentPlan
        currentPlanActionable
        onClick={onClick}
      >
        Continue with Unlimited
      </PlanPickerCta>,
    );

    const button = screen.getByRole("button", {
      name: "Continue with Unlimited",
    });
    expect(button).toBeEnabled();

    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("keeps a current-plan CTA disabled without an onboarding action", () => {
    const onClick = jest.fn();

    render(
      <PlanPickerCta
        variant="proAccent"
        surfaceTheme="app"
        isCurrentPlan
        onClick={onClick}
      >
        Your current plan
      </PlanPickerCta>,
    );

    const button = screen.getByRole("button", { name: "Your current plan" });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();
  });
});
