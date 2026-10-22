import * as React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTableToolbar } from "@altitutor/ui";

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

let page = 0;
beforeEach(() =>
  window.history.replaceState(null, "", `/toolbar-test-${++page}`),
);

function Toolbar() {
  const [filters, setFilters] = React.useState<Record<string, unknown[]>>({});
  return (
    <DataTableToolbar
      state={{
        search: "",
        filters,
        sortBy: null,
        sortDirection: "asc",
        groupBy: null,
        page: 1,
        pageSize: 20,
        visibleColumns: ["name"],
      }}
      onSearchChange={() => {}}
      onFiltersChange={setFilters}
      onSortChange={() => {}}
      onGroupByChange={() => {}}
      onVisibleColumnsChange={() => {}}
      onQuickFilterApply={() => {}}
      onReset={() => {}}
      filterDefinitions={[
        {
          key: "status",
          label: "Status",
          options: [{ value: "active", label: "Active" }],
        },
        {
          key: "curriculum",
          label: "Curriculum",
          options: [{ value: "sace", label: "SACE" }],
        },
      ]}
    />
  );
}

it("can type immediately into Add filter and open the matching field with the keyboard", async () => {
  render(<Toolbar />);
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Search filters…")).toHaveFocus(),
  );
  await userEvent.keyboard("Curriculum{ArrowDown}{ArrowRight}");
  expect(await screen.findByRole("option", { name: "SACE" })).toBeVisible();
  await userEvent.keyboard("{Escape}{Escape}{Escape}");
});

it("keeps only the currently hovered field submenu open", async () => {
  render(<Toolbar />);
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
  await userEvent.hover(screen.getByRole("menuitem", { name: "Status" }));
  expect(await screen.findByRole("option", { name: "Active" })).toBeVisible();
  await userEvent.hover(screen.getByRole("menuitem", { name: "Curriculum" }));
  expect(await screen.findByRole("option", { name: "SACE" })).toBeVisible();
  expect(
    screen.queryByRole("option", { name: "Active" }),
  ).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}{Escape}{Escape}");
});

it("saves a full view, applies it, and edits it by double-click without changing the screen draft", async () => {
  const { ToolbarViewsProvider } = await import("@altitutor/ui");
  const { getViewSettings } = await import("@altitutor/shared");
  const save = jest.fn(async (view) => ({
    ...view,
    id: view.id ?? "saved-1",
    created_at: "2026-10-22",
    updated_at: "2026-10-22",
  }));
  function Views() {
    const [settings, setSettings] = React.useState<
      import("@altitutor/shared").DisplaySettings
    >({
      layout: "list",
      filters: { status: ["active"] },
      sortBy: "priority",
      sortDirection: "desc",
      groupBy: "status",
      visibleColumns: ["name"],
    });
    const [views, setViews] = React.useState<
      import("@altitutor/shared").SavedView[]
    >([]);
    return (
      <ToolbarViewsProvider
        value={{
          userId: "staff-1",
          save: async (view) => {
            const result = await save(view);
            setViews((previous) => [
              ...previous.filter((item) => item.id !== result.id),
              result,
            ]);
            return result;
          },
        }}
      >
        <output data-testid="live-layout">{settings.layout}</output>
        <DataTableToolbar
          viewTarget="tasks"
          state={{ ...settings, search: "", page: 1, pageSize: 20 }}
          view={{
            value: settings.layout!,
            options: [
              { value: "list", label: "List" },
              { value: "board", label: "Board" },
            ],
            onChange: (layout) =>
              setSettings((previous) => ({ ...previous, layout })),
          }}
          onSearchChange={() => {}}
          onFiltersChange={(filters) =>
            setSettings((previous) => ({ ...previous, filters }))
          }
          onSortChange={(sortBy, sortDirection) =>
            setSettings((previous) => ({ ...previous, sortBy, sortDirection }))
          }
          onGroupByChange={(groupBy) =>
            setSettings((previous) => ({ ...previous, groupBy }))
          }
          onVisibleColumnsChange={(visibleColumns) =>
            setSettings((previous) => ({ ...previous, visibleColumns }))
          }
          onQuickFilterApply={(view) => {
            const value = getViewSettings(view.config);
            if (value) setSettings(value);
          }}
          onReset={() => {}}
          quickFilters={views}
          filterDefinitions={[
            {
              key: "status",
              label: "Status",
              options: [{ value: "active", label: "Active" }],
            },
          ]}
          columnDefinitions={[
            { key: "name", label: "Name" },
            { key: "assignee", label: "Assignee" },
          ]}
          sortOptions={[{ key: "priority", label: "Priority" }]}
          groupByOptions={[{ key: "status", label: "Status" }]}
        />
      </ToolbarViewsProvider>
    );
  }
  render(<Views />);
  await userEvent.click(screen.getByRole("button", { name: "New view" }));
  await userEvent.type(
    screen.getByRole("textbox", { name: "View name" }),
    "Morning",
  );
  const dialog = screen.getByRole("dialog", { name: "New view" });
  const { within } = await import("@testing-library/react");
  await userEvent.click(within(dialog).getByRole("button", { name: "Board" }));
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Assignee" }),
  );
  expect(screen.getByTestId("live-layout")).toHaveTextContent("list");
  await userEvent.click(
    within(dialog).getByRole("button", { name: "Save view" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("live-layout")).toHaveTextContent("board"),
  );
  expect(getViewSettings(save.mock.calls[0][0].config)).toEqual({
    layout: "board",
    filters: { status: ["active"] },
    sortBy: "priority",
    sortDirection: "desc",
    groupBy: "status",
    visibleColumns: ["name", "assignee"],
  });
  expect(screen.getByRole("button", { name: "Morning" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    screen.queryByRole("img", { name: "Custom display settings" }),
  ).not.toBeInTheDocument();
  await userEvent.dblClick(screen.getByRole("button", { name: "Morning" }));
  const edit = screen.getByRole("dialog", { name: "Edit view" });
  await userEvent.clear(
    within(edit).getByRole("textbox", { name: "View name" }),
  );
  await userEvent.type(
    within(edit).getByRole("textbox", { name: "View name" }),
    "Evening",
  );
  await userEvent.click(within(edit).getByRole("button", { name: "List" }));
  await userEvent.click(
    within(edit).getByRole("button", { name: "Save view" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Evening" })).toHaveAttribute(
      "aria-pressed",
      "true",
    ),
  );
  expect(save.mock.calls[1][0].id).toBe("saved-1");
  expect(screen.getByTestId("live-layout")).toHaveTextContent("list");
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Assignee" }));
  expect(
    screen.getByRole("img", { name: "Custom display settings" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Evening" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("img", { name: "Custom display settings" }),
    ).not.toBeInTheDocument(),
  );
});

it("edits date endpoints independently and changes the date comparison", async () => {
  function Dates() {
    const [filters, setFilters] = React.useState<Record<string, unknown[]>>({
      from: ["2026-10-01"],
      to: ["2026-10-22"],
    });
    return (
      <>
        <DataTableToolbar
          state={{
            search: "",
            filters,
            sortBy: null,
            sortDirection: "asc",
            groupBy: null,
            page: 1,
            pageSize: 20,
            visibleColumns: [],
          }}
          onSearchChange={() => {}}
          onFiltersChange={setFilters}
          onSortChange={() => {}}
          onGroupByChange={() => {}}
          onVisibleColumnsChange={() => {}}
          onQuickFilterApply={() => {}}
          onReset={() => {}}
          filterDefinitions={[
            {
              key: "date",
              label: "Date",
              type: "date-range",
              fromKey: "from",
              toKey: "to",
            },
          ]}
        />
        <output aria-label="Date state">{JSON.stringify(filters)}</output>
      </>
    );
  }
  render(<Dates />);
  await userEvent.click(
    screen.getByRole("button", { name: "Display options" }),
  );
  const pill = screen.getByRole("group", { name: "Date filter" });
  expect(
    within(pill).getByRole("button", { name: "Change start date for Date" }),
  ).toHaveTextContent("2026-10-01");
  expect(
    within(pill).getByRole("button", { name: "Change end date for Date" }),
  ).toHaveTextContent("2026-10-22");
  await userEvent.click(
    within(pill).getByRole("button", { name: "Change end date for Date" }),
  );
  await userEvent.type(
    await screen.findByPlaceholderText("Type a date..."),
    "2026-10-10{Enter}",
  );
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByLabelText("Date state").textContent!).to,
    ).toEqual(["2026-10-10"]),
  );
  expect(
    JSON.parse(screen.getByLabelText("Date state").textContent!).from,
  ).toEqual(["2026-10-01"]);
  await userEvent.click(
    within(pill).getByRole("button", { name: "Change operator for Date" }),
  );
  await userEvent.click(await screen.findByRole("option", { name: /^after$/ }));
  expect(JSON.parse(screen.getByLabelText("Date state").textContent!)).toEqual({
    from: ["2026-10-02"],
    date__operator: ["after"],
    date__anchor: ["2026-10-01"],
  });
  await userEvent.click(
    screen.getByRole("button", { name: "Change date for Date" }),
  );
  const input = await screen.findByPlaceholderText("Type a date...");
  await userEvent.type(input, "2026-10-10{Enter}");
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByLabelText("Date state").textContent!).from,
    ).toEqual(["2026-10-11"]),
  );
  await userEvent.keyboard("{Escape}{Escape}");
});
