import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClassesAddMenu } from "../ClassesAddMenu";
it("offers class and admin-shift creation from the Classes page action", async () => {
  const addClass = jest.fn(),
    addAdminShift = jest.fn();
  render(
    <ClassesAddMenu onAddClass={addClass} onAddAdminShift={addAdminShift} />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await userEvent.click(
    screen.getByRole("menuitem", { name: "Create admin shift" }),
  );
  expect(addAdminShift).toHaveBeenCalledTimes(1);
  expect(addClass).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Create" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Create class" }));
  expect(addClass).toHaveBeenCalledTimes(1);
});
