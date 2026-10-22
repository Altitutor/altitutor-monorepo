import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard, EntityList, ToolbarViewsProvider } from "@altitutor/ui";

beforeAll(() => {
  global.structuredClone = <T,>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;
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
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  expect(
    screen.getByRole("button", { name: "Change value for Due date" }),
  ).toHaveTextContent("22 Oct");
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
});

it("saves and applies a date-filtered entity View without exposing virtual toolbar keys", async () => {
  const { getViewSettings } = await import("@altitutor/shared");
  const saved = jest.fn(async (view) => ({
    ...view,
    id: "date-view",
    created_at: "2026-10-22",
    updated_at: "2026-10-22",
  }));
  const applied = jest.fn();
  const filters = {
    due_date: [{ type: "date_range", start: "2026-10-22", end: "2026-10-22" }],
  };
  render(
    <ToolbarViewsProvider value={{ userId: "staff", save: saved }}>
      <EntityList
        items={[
          { id: "a", name: "Morning", due: "2026-10-22T09:00:00" },
          { id: "b", name: "Evening", due: "2026-10-22T22:00:00" },
          { id: "c", name: "Next day", due: "2026-10-23T09:00:00" },
        ]}
        getItemId={(item) => item.id}
        renderName={(item) => <span>{item.name}</span>}
        rightPills={[
          {
            key: "due_date",
            label: "Due date",
            getValue: (item) => item.due,
            renderPill: () => null,
            filterType: "date-range",
          },
        ]}
        filters={filters}
        viewTarget="tasks"
        sortByOptions={[{key:'priority',label:'Priority'}]}
        onApplyQuickFilter={applied}
      />
    </ToolbarViewsProvider>,
  );
  expect(screen.getByText("Morning")).toBeVisible();
  expect(screen.getByText("Evening")).toBeVisible();
  expect(screen.queryByText("Next day")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "New view" }));
  expect(
    screen.getByRole("button", { name: "Change start date for Due date" }),
  ).toHaveTextContent("2026-10-22");
  await userEvent.click(screen.getByRole('button',{name:'Choose Sort'}));
  await userEvent.click(await screen.findByRole('option',{name:'None'}));
  await userEvent.type(
    screen.getByRole("textbox", { name: "View name" }),
    "Due today",
  );
  await userEvent.click(screen.getByRole("button", { name: "Save view" }));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  expect(getViewSettings(saved.mock.calls[0][0].config)?.sortDirection).toBe('asc');
  expect(getViewSettings(saved.mock.calls[0][0].config)?.filters).toEqual(
    filters,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Due today" }),
  );
  await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
  expect(getViewSettings(applied.mock.calls[0][0].config)?.filters).toEqual(
    filters,
  );
});
