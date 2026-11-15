/** @jest-environment jsdom */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { KeyboardCollection, CollectionRecord } from "../collection-keyboard";
import { KanbanBoard } from "../kanban-board";
import { KeyboardNavigationProvider } from "../keyboard-navigation";
it("selects two records with the keyboard and applies a chosen status only to those records", async () => {
  const apply = jest.fn().mockResolvedValue(undefined);
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  Element.prototype.scrollIntoView = jest.fn();
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }, { id: "two" }, { id: "three" }]}
          getItemId={(item) => item.id}
          actions={[
            {
              key: "s",
              label: "Status",
              options: [{ value: "done", label: "Done" }],
              apply,
            },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
          <CollectionRecord id="two">Two</CollectionRecord>
          <CollectionRecord id="three">Three</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(document.activeElement!, { key: "x" });
  fireEvent.keyDown(document.activeElement!, { key: "j", shiftKey: true });
  expect(screen.getByText("2 selected")).toBeTruthy();
  fireEvent.keyDown(document.activeElement!, { key: "s" });
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(2));
  expect(apply.mock.calls).toEqual([
    [{ id: "one" }, "done"],
    [{ id: "two" }, "done"],
  ]);
});

it("reports partial failure and retries only failed records through the keyboard picker", async () => {
  const apply = jest
    .fn()
    .mockImplementation((item: { id: string }) =>
      item.id === "one" && apply.mock.calls.length === 1
        ? Promise.reject(new Error("Conflict"))
        : Promise.resolve(),
    );
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }, { id: "two" }]}
          getItemId={(item) => item.id}
          actions={[
            {
              key: "s",
              label: "Status",
              options: [{ value: "done", label: "Done" }],
              apply,
            },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
          <CollectionRecord id="two">Two</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(document.body, { key: "j" });
  fireEvent.keyDown(document.activeElement!, { key: "x" });
  fireEvent.keyDown(document.activeElement!, { key: "j", shiftKey: true });
  fireEvent.keyDown(document.activeElement!, { key: "s" });
  fireEvent.keyDown(screen.getByPlaceholderText("Search options…"), {
    key: "Enter",
  });
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("1 record(s)"),
  );
  expect(screen.getByText("1 selected")).toBeTruthy();
  fireEvent.keyDown(screen.getByPlaceholderText("Search options…"), {
    key: "Enter",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(apply.mock.calls.map(([item]) => item.id)).toEqual([
    "one",
    "two",
    "one",
  ]);
});

it("leaves Enter on the selection button to its native action instead of opening the record", () => {
  const open = jest.fn();
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  render(
    <KeyboardNavigationProvider value={true}>
      <main data-admin-main>
        <KeyboardCollection
          items={[{ id: "one" }]}
          getItemId={(item) => item.id}
          onOpen={open}
          actions={[
            { key: "s", label: "Status", options: [], apply: jest.fn() },
          ]}
        >
          <CollectionRecord id="one">One</CollectionRecord>
        </KeyboardCollection>
      </main>
    </KeyboardNavigationProvider>,
  );
  const select = screen.getByRole("button", { name: "Select record" });
  act(() => select.focus());
  expect(fireEvent.keyDown(select, { key: "Enter" })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});

it("keeps sortable cards named by their content while exposing a separate selection control", () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(), unobserve: jest.fn(), disconnect: jest.fn(),
  }));
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn(),
  });
  const items = [{ id: "one", status: "backlog" }];
  render(
    <KeyboardNavigationProvider value={true}>
      <KeyboardCollection items={items} getItemId={item => item.id} actions={[
        { key: "s", label: "Status", options: [], apply: jest.fn() },
      ]}>
        <KanbanBoard hideToolbar items={items} getItemId={item => item.id}
          columnDefs={[{ key: "status", label: "Status", getValue: item => item.status,
            options: [{ value: "backlog", label: "Backlog" }], onValueChange: jest.fn() }]}
          activeColumnKey="status" rightPills={[]}
          renderCard={() => <div>Board drag check 001 <button>Urgent</button></div>}
        />
      </KeyboardCollection>
    </KeyboardNavigationProvider>,
  );
  const card = screen.getByRole("button", { name: /^Board drag check 001 / });
  const content = document.getElementById(card.getAttribute("aria-labelledby")!);
  expect(content?.textContent).toBe("Board drag check 001 Urgent");
  expect(content?.contains(screen.getByRole("button", { name: "Select record" }))).toBe(false);
});
