import React from "react";
import { render, screen } from "@testing-library/react";

import { ScheduledPlanDowngradeNotice } from "@/features/subscription/components/scheduled-plan-downgrade-notice";

describe("ScheduledPlanDowngradeNotice", () => {
  it("shows the downgrade date and retained-access message", () => {
    render(<ScheduledPlanDowngradeNotice endDate="2026-09-12" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "You're downgrading to UCAT Free on 12/09/2026. You'll keep paid access until then.",
    );
  });
});
