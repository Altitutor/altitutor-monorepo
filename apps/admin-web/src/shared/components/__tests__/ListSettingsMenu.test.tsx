import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminPageActionsTarget } from "@/shared/components/AdminPageActions";
import { ListSettingsMenu } from "../ListSettingsMenu";

function Harness({ children }: { children: React.ReactNode }) {
  const [secondary, setSecondary] = useState<HTMLDivElement | null>(null);
  return (
    <AdminPageActionsTarget.Provider value={{ primary: null, secondary }}>
      <div ref={setSecondary} />
      {children}
    </AdminPageActionsTarget.Provider>
  );
}

test("a single settings page is the menu itself", () => {
  render(<Harness><ListSettingsMenu list="mail" /></Harness>);
  expect(screen.getByRole("link", { name: "Go to Email" })).toHaveAttribute("href", "/settings/email");
});

test("several settings pages open from Go to settings", async () => {
  render(<Harness><ListSettingsMenu list="parents" /></Harness>);
  expect(screen.queryByRole("button", { name: "Go to settings" })).not.toBeInTheDocument();
  render(<Harness><ListSettingsMenu list="students" /></Harness>);
  await userEvent.click(screen.getByRole("button", { name: "Go to settings" }));
  expect(screen.getByRole("menuitem", { name: "Duplicate students" })).toHaveAttribute("href", "/settings/duplicate-students");
  expect(screen.getByRole("menuitem", { name: "Deleted entities" })).toHaveAttribute("href", "/settings/deleted-records?kind=student");
});
