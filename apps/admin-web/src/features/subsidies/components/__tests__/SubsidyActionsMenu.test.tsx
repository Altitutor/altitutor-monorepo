import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubsidyActionsMenu } from "../SubsidyActionsMenu";

it("offers Edit and Delete from a labelled three-dot menu", async () => {
  const user = userEvent.setup();
  const edit = jest.fn();
  const remove = jest.fn();
  render(<SubsidyActionsMenu onEdit={edit} onDelete={remove} />);
  expect(
    screen.queryByRole("menuitem", { name: "Edit subsidy" }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Subsidy actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Edit subsidy" }));
  expect(edit).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Subsidy actions" }));
  await user.click(screen.getByRole("menuitem", { name: "Delete subsidy" }));
  expect(remove).toHaveBeenCalledTimes(1);
});

it("prevents further actions while a deletion is pending", () => {
  render(
    <SubsidyActionsMenu onEdit={jest.fn()} onDelete={jest.fn()} disabled />,
  );
  expect(
    screen.getByRole("button", { name: "Subsidy actions" }),
  ).toBeDisabled();
});
