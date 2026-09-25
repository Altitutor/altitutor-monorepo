import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { ScheduledPlanDowngradeNoticeWithActions } from "@/features/subscription/components/scheduled-plan-downgrade-notice-with-actions";

jest.mock("@/features/subscription/hooks/use-ucat-subscription-billing", () => ({
  useUcatSubscriptionBilling: () => ({ refetch: jest.fn() }),
}));

jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock("@/features/subscription/api/change-subscription-cancellation", () => ({
  resumeUcatSubscription: jest.fn(),
  cancelUcatSubscriptionImmediately: jest.fn(),
}));

jest.mock("@/features/subscription/api/track-subscription-journey", () => ({
  trackSubscriptionJourneyEvent: jest.fn(),
}));

jest.mock(
  "@/features/subscription/components/immediate-plan-cancellation-dialog",
  () => ({
    ImmediatePlanCancellationDialog: ({
      open,
      onConfirm,
    }: {
      open: boolean;
      onConfirm: () => void;
    }) =>
      open ? (
        <div role="alertdialog" aria-label="Downgrade to UCAT Free now?">
          <button type="button" onClick={onConfirm}>
            Confirm downgrade
          </button>
        </div>
      ) : null,
  }),
);

describe("ScheduledPlanDowngradeNoticeWithActions", () => {
  it("shows downgrade and keep paid actions", () => {
    render(
      <ScheduledPlanDowngradeNoticeWithActions
        endDate="2026-10-18"
        planTier="unlimited"
      />,
    );

    expect(
      screen.getByRole("button", { name: "Downgrade now" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep paid plan" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You're downgrading to UCAT Free on/i),
    ).toBeInTheDocument();
  });

  it("opens immediate downgrade confirmation", () => {
    render(
      <ScheduledPlanDowngradeNoticeWithActions
        endDate="2026-10-18"
        planTier="unlimited"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Downgrade now" }));

    expect(
      screen.getByRole("alertdialog", {
        name: "Downgrade to UCAT Free now?",
      }),
    ).toBeInTheDocument();
  });
});
