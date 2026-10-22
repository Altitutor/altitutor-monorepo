import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EntityCollection, ToolbarViewProvider } from "@altitutor/ui";

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
it("keeps the same toolbar and search input when switching collection layouts", async () => {
  function Collection() {
    const [layout, setLayout] = React.useState<"list" | "board">("list");
    const [search, setSearch] = React.useState("");
    return (
      <ToolbarViewProvider
        value={{
          value: layout,
          onChange: (value) => setLayout(value as "list" | "board"),
          options: [
            { value: "list", label: "List" },
            { value: "board", label: "Board" },
          ],
        }}
      >
        <EntityCollection
          layout={layout}
          items={[{ id: "a", name: "Alpha", status: "todo" }]}
          getItemId={(item) => item.id}
          renderName={(item) => <span>{item.name}</span>}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search collection"
          rightPills={[
            {
              key: "status",
              label: "Status",
              getValue: (item) => item.status,
              renderPill: () => null,
            },
          ]}
          getGroupLabel={() => "Todo"}
          groupBy="status"
          board={{
            columnDefs: [
              {
                key: "status",
                label: "Status",
                getValue: (item) => item.status,
                options: [{ value: "todo", label: "Todo" }],
                onValueChange: () => {},
              },
            ],
            renderCard: (item) => <span>{item.name}</span>,
          }}
        />
      </ToolbarViewProvider>
    );
  }
  render(<Collection />);
  const searchButton = screen.getByRole("button", { name: "Search" });
  const display = screen.getByRole("button", { name: "Display options" });
  await userEvent.click(screen.getByRole("button", { name: "Collapse Todo" }));
  await userEvent.click(searchButton);
  await userEvent.type(screen.getByPlaceholderText("Search collection"), "Al");
  await userEvent.keyboard("{Escape}");
  await userEvent.click(display);
  await userEvent.click(
    screen.getByRole("button", { name: "Board", pressed: false }),
  );
  expect(screen.getByRole("button", { name: "Search" })).toBe(searchButton);
  expect(screen.getByRole("button", { name: "Display options" })).toBe(display);
  expect(screen.getByText("Alpha")).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "List", pressed: false }),
  );
  expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
  await userEvent.keyboard("{Escape}");
  await userEvent.click(searchButton);
  expect(screen.getByPlaceholderText("Search collection")).toHaveValue("Al");
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Expand Todo" }));
  expect(screen.getByText("Alpha")).toBeVisible();
});
