/** @jest-environment jsdom */
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
  const search = screen.getByPlaceholderText("Search menu…");
  fireEvent.change(search, { target: { value: "archive" } });
  await waitFor(() =>
    expect(
      screen.getByRole("menuitem", { name: "Move to folder → Archive" }),
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
