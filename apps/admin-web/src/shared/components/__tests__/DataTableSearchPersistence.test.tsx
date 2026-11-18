import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTableToolbar } from "@altitutor/ui";

it("keeps an active search visible after focus moves outside the toolbar", async () => {
  const user = userEvent.setup();
  render(
    <>
      <DataTableToolbar
        state={{
          search: "Hannah",
          filters: {},
          sortBy: null,
          sortDirection: "asc",
          groupBy: null,
          page: 1,
          pageSize: 50,
          visibleColumns: [],
        }}
        onSearchChange={() => {}}
        onFiltersChange={() => {}}
        onSortChange={() => {}}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={() => {}}
        onQuickFilterApply={() => {}}
        onReset={() => {}}
        hideViews
      />
      <button type="button">Outside</button>
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Outside" }));
  expect(screen.getByRole("textbox", { name: "Search records" })).toHaveValue(
    "Hannah",
  );
});
