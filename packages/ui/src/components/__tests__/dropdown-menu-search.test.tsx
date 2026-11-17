/** @jest-environment jsdom */
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { ActionSearchScope, useMenuEntry } from "../dropdown-menu-search";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { KeyboardNavigationProvider } from "../keyboard-navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "../dropdown-menu";
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
});
it("reveals search on typing, finds an unopened submenu action, and invokes it once", async () => {
  const move = jest.fn();
  render(
    <KeyboardNavigationProvider value={true}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Reply</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to folder</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={move}>Archive</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(screen.getByRole("menu"), { key: "a" });
  const search = screen.getByRole("combobox", { name: "Search menu" });
  expect(search.closest("[cmdk-root]")).not.toBeNull();
  fireEvent.change(search, { target: { value: "archive" } });
  await waitFor(() =>
    expect(
      screen.getByRole("option", { name: "Move to folder → Archive" }),
    ).toBeTruthy(),
  );
  fireEvent.keyDown(search, { key: "Enter" });
  expect(move).toHaveBeenCalledTimes(1);
});

it("does not offer disabled submenu actions as searchable results", () => {
  render(
    <KeyboardNavigationProvider value={true}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled>
              Delete records
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Delete permanently</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(screen.getByRole("menu"), { key: "d" });
  expect(
    screen.queryByRole("menuitem", {
      name: "Delete records → Delete permanently",
    }),
  ).toBeNull();
  expect(screen.getByText("No matching actions")).toBeTruthy();
});

it("opens a submenu picker from search without invoking an unavailable action", async () => {
  render(
    <KeyboardNavigationProvider value={true}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Choose folder</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <input aria-label="Folder picker" />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(screen.getByRole("menu"), { key: "f" });
  fireEvent.keyDown(screen.getByPlaceholderText("Search menu…"), {
    key: "Enter",
  });
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Folder picker" })).toBeTruthy(),
  );
});

it("starts searching the whole menu when typing inside an already-open submenu", () => {
  render(
    <KeyboardNavigationProvider value={true}>
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Archive</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </KeyboardNavigationProvider>,
  );
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Move" }), {
    key: "ArrowRight",
  });
  fireEvent.keyDown(screen.getByRole("menuitem", { name: "Archive" }), {
    key: "a",
  });
  expect(screen.getByPlaceholderText("Search menu…")).toBeTruthy();
});


it("preserves native Space activation for a focused hover action", async () => {
  const run = jest.fn();
  function Action() {
    const ref = useRef<HTMLButtonElement>(null);
    useMenuEntry(ref, false);
    return <button ref={ref} onClick={run}>Log session</button>;
  }
  render(<ActionSearchScope><Action /></ActionSearchScope>);
  screen.getByRole('button', {name:'Log session'}).focus();
  await userEvent.keyboard(' ');
  expect(run).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('combobox')).toBeNull();
});
