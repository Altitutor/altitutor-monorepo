import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClassesAddMenu } from "../ClassesAddMenu";
it("offers class and admin-shift creation from the Classes page action", async () => {
  const addClass = jest.fn(),
    addAdminShift = jest.fn();
  render(
    <ClassesAddMenu onAddClass={addClass} onAddAdminShift={addAdminShift} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await userEvent.click(
    screen.getByRole("menuitem", { name: "Add admin shift" }),
  );
  expect(addAdminShift).toHaveBeenCalledTimes(1);
  expect(addClass).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Add class" }));
  expect(addClass).toHaveBeenCalledTimes(1);
});
