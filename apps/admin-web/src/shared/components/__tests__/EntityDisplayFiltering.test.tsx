import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@altitutor/ui";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
});

it("keeps board date choices effective when a date pill shares the key and clears sorting to ascending names", async () => {
  const sortChanged = jest.fn();
  const items = [
    { id: "a", name: "Alpha", date: "2026-10-22" },
    { id: "b", name: "Beta", date: "2026-10-23" },
  ];
  function Board() {
    const [filters, setFilters] = React.useState<Record<string, unknown[]>>({});
    return (
      <KanbanBoard
        items={items}
        getItemId={(item) => item.id}
        renderCard={(item) => <span>{item.name}</span>}
        columnDefs={[
          {
            key: "date",
            label: "Due date",
            getValue: (item) => item.date,
            options: [
              { value: "2026-10-22", label: "22 Oct" },
              { value: "2026-10-23", label: "23 Oct" },
            ],
            onValueChange: () => {},
          },
        ]}
        activeColumnKey="date"
        rightPills={[
          {
            key: "date",
            label: "Due date",
            getValue: (item) => item.date,
            renderPill: () => null,
            filterType: "date-range",
          },
        ]}
        filters={filters}
        onFiltersChange={setFilters}
        sortBy="date"
        sortDirection="desc"
        sortByOptions={[{ key: "date", label: "Due date" }]}
        onSortChange={sortChanged}
      />
    );
  }
  render(<Board />);
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Due date" }));
  await userEvent.click(await screen.findByRole("option", { name: "22 Oct" }));
  await userEvent.keyboard("{Escape}");
  expect(
    screen.getAllByRole("button", { name: "Change value for Due date" })[0],
  ).toHaveTextContent("22 Oct");
  if (
    screen
      .getByRole("button", { name: "Display options" })
      .getAttribute("aria-expanded") !== "true"
  )
    await userEvent.click(
      screen.getByRole("button", { name: "Display options" }),
    );
  await userEvent.click(screen.getByRole("button", { name: "Sort ascending" }));
  expect(sortChanged).toHaveBeenLastCalledWith("date", "asc");
  await userEvent.click(screen.getByRole("button", { name: "Choose Sort" }));
  await userEvent.click(await screen.findByRole("option", { name: "None" }));
  expect(sortChanged).toHaveBeenLastCalledWith("name", "asc");
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Beta")).not.toBeInTheDocument(),
  );
  expect(screen.getByText("Alpha")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Change value for Due date" }),
  ).toHaveTextContent("22 Oct");
});
