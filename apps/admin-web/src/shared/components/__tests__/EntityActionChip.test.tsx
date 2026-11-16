import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityActionChip } from "../EntityActionChip";

it("opens the record directly when a chip is clicked", async () => {
  const open = jest.fn();
  render(
    <EntityActionChip
      entityType="class"
      entityId="class-id"
      label="Maths"
      onClick={open}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: "Maths" }));
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});
