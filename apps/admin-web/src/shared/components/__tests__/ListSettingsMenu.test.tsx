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

test("a single settings destination remains in the actions dropdown", async () => {
  render(<Harness><ListSettingsMenu list="mail" /></Harness>);
  await userEvent.click(screen.getByRole("button", { name: "Go to settings" }));
  expect(screen.getByRole("menuitem", { name: "Go to settings" })).toHaveAttribute("href", "/settings/email");
});

test("several settings destinations share a Go to settings submenu", async () => {
  render(<Harness><ListSettingsMenu list="students" /></Harness>);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Go to settings" }));
  await user.hover(screen.getByRole("menuitem", { name: "Go to settings" }));
  expect(await screen.findByRole("menuitem", { name: "Duplicate students" })).toHaveAttribute("href", "/settings/duplicate-students");
  expect(screen.getByRole("menuitem", { name: "Deleted entities" })).toHaveAttribute("href", "/settings/deleted-records?kind=student");
});
