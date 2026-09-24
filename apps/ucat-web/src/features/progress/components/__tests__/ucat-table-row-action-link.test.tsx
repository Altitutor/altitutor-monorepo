import React from "react";
import { render, screen } from "@testing-library/react";
import { UcatTableRowActionLink } from "../ucat-table-row-action-link";

describe("UcatTableRowActionLink", () => {
  it("announces unreviewed attempts from the action link", () => {
    render(
      <UcatTableRowActionLink
        href="/progress/set-attempts/attempt-1"
        label="View attempt"
        unreviewed
      />,
    );

    expect(
      screen.getByRole("link", {
        name: "View attempt. This attempt is unreviewed.",
      }),
    ).toHaveAttribute("href", "/progress/set-attempts/attempt-1");
  });

  it("keeps the standard label for reviewed attempts", () => {
    render(
      <UcatTableRowActionLink
        href="/progress/set-attempts/attempt-2"
        label="View attempt"
      />,
    );

    expect(
      screen.getByRole("link", { name: "View attempt" }),
    ).toHaveAttribute("href", "/progress/set-attempts/attempt-2");
  });
});
