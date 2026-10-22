import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { DataTableToolbar } from "@altitutor/ui";
import { AuditCatalogFilterMenu } from "../AuditCatalogFilterMenu";
(globalThis as typeof globalThis & { React: typeof React }).React = React;

// Use the real primitives without loading unrelated rich-text ESM dependencies.
jest.mock("@altitutor/ui", () => ({
  ...jest.requireActual("@altitutor/ui/components/checkbox"),
  ...jest.requireActual("@altitutor/ui/components/input"),
  ...jest.requireActual("@altitutor/ui/components/button"),
  ...jest.requireActual("@altitutor/ui/components/popover"),
  ...jest.requireActual("@altitutor/ui/components/data-table-toolbar"),
}));

beforeAll(() => {
  window.matchMedia = jest
    .fn()
    .mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
});

const RUN = {
  id: "71000000-0000-0000-0000-000000000001",
  title: "All draft stems",
  status: "active",
  created_at: "2026-08-19T10:00:00.000Z",
};

describe("AuditCatalogFilterMenu", () => {
  it("selects every stem in an audit from the audit row", () => {
    const onSelectedValuesChange = jest.fn();
    render(
      <AuditCatalogFilterMenu
        runs={[RUN]}
        selectedValues={[]}
        onSelectedValuesChange={onSelectedValuesChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "All draft stems" }));
    expect(onSelectedValuesChange).toHaveBeenCalledWith([RUN.id]);
  });

  it("can add a single status from that audit selector", async () => {
    const onSelectedValuesChange = jest.fn();
    render(
      <AuditCatalogFilterMenu
        runs={[RUN]}
        selectedValues={[]}
        onSelectedValuesChange={onSelectedValuesChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Choose statuses for All draft stems",
      }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: "Failed" }));
    expect(onSelectedValuesChange).toHaveBeenCalledWith([`${RUN.id}:failed`]);
  });
});

it("edits the audit through Add filter and its active toolbar pill", async () => {
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
            key: "audit",
            label: "Audit",
            options: [{ value: "not_audited", label: "Not audited" }],
          },
        ]}
        customFilterContent={{
          audit: (
            <AuditCatalogFilterMenu
              runs={[RUN]}
              selectedValues={(filters.audit ?? []).map(String)}
              onSelectedValuesChange={(values) =>
                setFilters(values.length ? { audit: values } : {})
              }
            />
          ),
        }}
      />
    );
  }
  render(<Toolbar />);
  fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Add filter" }), {
    key: "Enter",
  });
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Audit" }), {
    key: "ArrowRight",
  });
  fireEvent.click(await screen.findByRole("checkbox", { name: "Not audited" }));
  fireEvent.keyDown(document, { key: "Escape" });
  fireEvent.keyDown(document, { key: "Escape" });
  if (
    screen
      .getByRole("button", { name: "Display options" })
      .getAttribute("aria-expanded") === "true"
  )
    fireEvent.click(screen.getByRole("button", { name: "Display options" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Change value for Audit" }),
  );
  fireEvent.click(await screen.findByRole("checkbox", { name: "Not audited" }));
  expect(
    screen.queryByRole("button", { name: "Remove filter for Audit" }),
  ).not.toBeInTheDocument();
});
