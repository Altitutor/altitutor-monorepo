import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StaffAccountNotice } from "@/features/auth/components/staff-account-notice";
import { navigateAfterAuth } from "@/features/auth/lib/navigate-after-auth";

jest.mock("@/features/auth/lib/navigate-after-auth", () => ({
  navigateAfterAuth: jest.fn(),
}));

describe("StaffAccountNotice", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
  });

  it.each([
    ["TUTOR", "Tutor Portal", "https://tutor.altitutor.com"],
    ["ADMINSTAFF", "Admin Portal", "https://admin.altitutor.com"],
  ] as const)("sends %s to the canonical staff portal", (role, label, href) => {
    render(<StaffAccountNotice role={role} />);

    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  });

  it("signs out before offering signup with another account", async () => {
    render(<StaffAccountNotice role="TUTOR" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Use another account" }),
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/signout", {
        method: "POST",
      }),
    );
    expect(navigateAfterAuth).toHaveBeenCalledWith("/signup");
  });
});
