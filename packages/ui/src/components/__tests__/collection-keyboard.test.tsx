/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeyboardCollection, CollectionRecord } from "../collection-keyboard";
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
