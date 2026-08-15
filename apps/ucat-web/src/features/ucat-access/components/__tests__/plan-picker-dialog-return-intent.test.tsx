import React from "react";
import { render } from "@testing-library/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { useUpsellDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { PlanPickerDialog } from "../plan-picker-dialog";

jest.mock("next/navigation", () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock("@/features/ucat-access/context/upsell-dialog-context", () => ({
  useUpsellDialog: jest.fn(),
}));

jest.mock(
  "@/features/subscription/components/plan-picker/plan-picker-dialog-shell",
  () => ({
    PlanPickerDialogShell: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  }),
);

jest.mock("@/features/subscription/components/plan-picker/plan-picker", () => ({
  PlanPicker: jest.fn(() => null),
}));

jest.mock("@/features/subscription/api/track-subscription-journey", () => ({
  trackSubscriptionJourneyEvent: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseRouter = jest.mocked(useRouter);
const mockedUseSearchParams = jest.mocked(useSearchParams);
const mockedUseUpsellDialog = jest.mocked(useUpsellDialog);
const mockedPlanPicker = jest.mocked(PlanPicker);

describe("PlanPickerDialog checkout return intent", () => {
  it("passes the quota-blocked page and its query string into checkout", () => {
    mockedUsePathname.mockReturnValue("/sets/section-a/set-123");
    mockedUseSearchParams.mockReturnValue(
      new URLSearchParams("session=lesson-7") as ReturnType<
        typeof useSearchParams
      >,
    );
    mockedUseRouter.mockReturnValue({ replace: jest.fn() } as never);
    mockedUseUpsellDialog.mockReturnValue({
      planPickerOpen: true,
      planPickerContext: {
        kind: "quota_limit",
        payload: {
          code: "QUOTA_EXCEEDED",
          area: "sets",
          used: 2,
          limit: 2,
          period: "week",
        },
      },
      closePlanPicker: jest.fn(),
      closeQuotaLimit: jest.fn(),
    } as never);

    render(<PlanPickerDialog />);

    expect(mockedPlanPicker.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        postCheckoutReturnTo: "/sets/section-a/set-123?session=lesson-7",
      }),
    );
  });
});
