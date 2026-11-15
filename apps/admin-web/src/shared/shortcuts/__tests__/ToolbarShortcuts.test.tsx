import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DataTableToolbar, KeyboardNavigationProvider } from "@altitutor/ui";
beforeAll(() => {
  global.ResizeObserver = jest
    .fn()
    .mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  window.matchMedia = jest
    .fn()
    .mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    });
  Element.prototype.scrollIntoView = jest.fn();
});
it("opens Add filter directly with F and leaves typing alone", async () => {
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <input aria-label="Editor" />
        <DataTableToolbar
          state={{
            search: "",
            filters: {},
            sortBy: null,
            sortDirection: "asc",
            groupBy: null,
            visibleColumns: [],
            page: 1,
            pageSize: 50,
          }}
          filterDefinitions={[
            {
              key: "status",
              label: "Status",
              options: [{ value: "done", label: "Done" }],
            },
          ]}
          onSearchChange={jest.fn()}
          onFiltersChange={jest.fn()}
          onSortChange={jest.fn()}
          onGroupByChange={jest.fn()}
          onVisibleColumnsChange={jest.fn()}
          onQuickFilterApply={jest.fn()}
          onReset={jest.fn()}
        />
      </main>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(screen.getByLabelText("Editor"), { key: "f" });
  expect(screen.queryByRole("menu")).toBeNull();
  fireEvent.keyDown(document.body, { key: "f" });
  await waitFor(() => expect(screen.getByRole("menu")).toBeInTheDocument());
  expect(screen.getByPlaceholderText("Search filters…")).toBeInTheDocument();
});
