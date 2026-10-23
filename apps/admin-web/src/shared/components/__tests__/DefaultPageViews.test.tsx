import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataTableToolbar, ToolbarViewsProvider } from "@altitutor/ui";
import { getViewSettings, type DisplaySettings } from "@altitutor/shared";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";

jest.mock("@/features/quick-filters/api/quick-filters", () => ({
  quickFiltersApi: { list: jest.fn(async () => []) },
}));
const settings: DisplaySettings = {
  filters: { status: ["ACTIVE"] },
  sortBy: "status",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: ["student", "status"],
};
it("offers an active built-in page default before saved views load and reapplies its whole configuration", async () => {
  const applied = jest.fn(),
    save = jest.fn();
  function Views() {
    const { data: views = [] } = useQuickFilters("students", {
      name: "Active",
      settings,
    });
    return (
      <ToolbarViewsProvider value={{ userId: "staff", save }}>
        <DataTableToolbar
          viewTarget="students"
          quickFilters={views}
          onQuickFilterApply={applied}
          state={{ ...settings, search: "", page: 1, pageSize: 50 }}
          onGroupByChange={() => {}}
          onReset={() => {}}
          onSearchChange={() => {}}
          onFiltersChange={() => {}}
          onSortChange={() => {}}
          onVisibleColumnsChange={() => {}}
          filterDefinitions={[]}
          sortOptions={[]}
          columnDefinitions={[
            { key: "student", label: "Student" },
            { key: "status", label: "Status" },
          ]}
        />
      </ToolbarViewsProvider>
    );
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <Views />
    </QueryClientProvider>,
  );
  const active = screen.getByRole("button", { name: "Active", pressed: true });
  await userEvent.click(active);
  await waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
  expect(getViewSettings(applied.mock.calls[0][0].config)).toEqual(settings);
  await userEvent.dblClick(active);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(save).not.toHaveBeenCalled();
  client.clear();
});

it("opens search from an icon and focuses the search field", async () => {
  render(
    <DataTableToolbar
      state={{ ...settings, search: "", page: 1, pageSize: 50 }}
      quickFilters={[]}
      onQuickFilterApply={() => {}}
      onGroupByChange={() => {}}
      onReset={() => {}}
      onSearchChange={() => {}}
      onFiltersChange={() => {}}
      onSortChange={() => {}}
      onVisibleColumnsChange={() => {}}
      filterDefinitions={[]}
      sortOptions={[]}
      columnDefinitions={[]}
    />,
  );
  expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(await screen.findByPlaceholderText("Search...")).toHaveFocus();
});
