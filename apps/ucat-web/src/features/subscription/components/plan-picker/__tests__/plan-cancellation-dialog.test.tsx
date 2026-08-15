import React from "react";
import { render, screen } from "@testing-library/react";
import { PlanCancellationDialog } from "@/features/subscription/components/plan-picker/plan-cancellation-dialog";

const baseProps = {
  open: true,
  onOpenChange: jest.fn(),
  currentPlanName: "UCAT Unlimited",
  paidAccessEndsAt: "2026-08-20T00:00:00.000Z",
  benefitsLost: ["Unlimited practice"],
  earnedDiscountCents: 0,
  earnedDiscountCurrency: "aud",
  reason: null,
  onReasonChange: jest.fn(),
  comment: "",
  onCommentChange: jest.fn(),
  confirming: false,
  error: null,
  onConfirm: jest.fn(),
};

describe("PlanCancellationDialog", () => {
  it("shows lost benefits and a positive earned discount when downgrading to Free", () => {
    render(
      <PlanCancellationDialog
        {...baseProps}
        targetPlan="free"
        earnedDiscountCents={600}
        omitAudPrefix
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Are you sure you want to downgrade to UCAT Free?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Unlimited practice")).toBeInTheDocument();
    expect(
      screen.getByText("You've already earned $6.00 off your next bill"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /downgrade to free on/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("radiogroup", {
        name: "Main reason for downgrading to UCAT Free",
      }),
    ).toBeInTheDocument();
  });

  it("does not mention a next-bill discount when none has been earned", () => {
    render(<PlanCancellationDialog {...baseProps} targetPlan="free" />);

    expect(screen.queryByText(/off your next bill/i)).not.toBeInTheDocument();
  });
});
