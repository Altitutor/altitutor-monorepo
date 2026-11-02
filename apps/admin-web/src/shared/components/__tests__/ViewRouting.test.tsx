import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTableToolbar } from "@altitutor/ui";
import { encodeViewConfig } from "@altitutor/shared";
import { useDataTable } from "@/shared/hooks/useDataTable";

const mockReplace = jest.fn();
let mockSearch = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: mockReplace }),
  usePathname: () => "/tasks",
  useSearchParams: () => mockSearch,
}));
const keys = ["status", "due_date"];
const saved = {
  id: "board",
  user_id: null,
  target_entity: "tasks",
  name: "Board view",
  created_at: "2026-10-22",
  updated_at: "2026-10-22",
  config: encodeViewConfig({
    layout: "board",
    filters: {
      status: ["active"],
      due_date: [{ type: "date_range", start: "2026-10-22" }],
    },
    sortBy: "priority",
    sortDirection: "desc",
    groupBy: "status",
    visibleColumns: [],
  }),
};
function Toolbar() {
  const table = useDataTable({
    defaultSort: { field: "priority", direction: "asc" },
    defaultVisibleColumns: ["name"],
    defaultGroupBy: "status",
    filterKeys: keys,
  });
  return (
    <>
      <output data-testid="table-state">{JSON.stringify(table.state)}</output>
      <DataTableToolbar
        state={table.state}
        onSearchChange={table.setSearch}
        onFiltersChange={table.setFilters}
        onSortChange={table.setSort}
        onGroupByChange={table.setGroupBy}
        onVisibleColumnsChange={table.setVisibleColumns}
        onQuickFilterApply={(view) => table.applyQuickFilter(view, "staff-1")}
        onReset={table.resetFilters}
        quickFilters={[saved]}
        view={{
          value: table.state.view ?? "list",
          options: [
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ],
          onChange: () => {},
        }}
      />
    </>
  );
}

it("applies the full View in one URL update and restores empty properties and date ranges on reload", async () => {
  mockSearch = new URLSearchParams();
  const first = render(<Toolbar />);
  await userEvent.click(screen.getByRole("button", { name: "Board view" }));
  await waitFor(() =>
    expect(screen.getByTestId("table-state")).toHaveTextContent(
      '"view":"board"',
    ),
  );
  const href = String(mockReplace.mock.calls.at(-1)?.[0]);
  const params = new URL(href, "http://localhost").searchParams;
  expect(params.get("view")).toBe("board");
  expect(params.get("sort")).toBe("priority");
  expect(params.get("order")).toBe("desc");
  expect(params.get("group")).toBe("status");
  expect(params.get("columns")).toBe("");
  first.unmount();
  mockSearch = params;
  render(<Toolbar />);
  const state = JSON.parse(screen.getByTestId("table-state").textContent!);
  expect(state.filters).toEqual({
    status: ["active"],
    due_date: [{ type: "date_range", start: "2026-10-22" }],
  });
  expect(state.visibleColumns).toEqual([]);
  expect(state.view).toBe("board");
});

it("keeps explicitly ungrouped Views ungrouped after reload, including operator metadata", async () => {
  const settings = getViewSettingsForTest();
  mockSearch = new URLSearchParams({sort:'__none__',group:'__none__',due_date__operator:'after',due_date__anchor:'2026-10-21',due_date:'json:'+JSON.stringify(settings)});
  render(<Toolbar />);
  const state = JSON.parse(screen.getByTestId('table-state').textContent!);
  expect(state.groupBy).toBeNull();
  expect(state.sortBy).toBeNull();
  expect(state.filters.due_date__operator).toEqual(['after']);
  expect(state.filters.due_date).toEqual(settings);
});
function getViewSettingsForTest() {return [{type:'date_range',start:'2026-10-22'}];}
