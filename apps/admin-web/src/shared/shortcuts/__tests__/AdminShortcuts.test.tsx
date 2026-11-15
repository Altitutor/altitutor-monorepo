import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Form,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@altitutor/ui";
import { TaskStatusField } from "@/features/tasks/components/fields/TaskStatusField";
import type { TaskFormData } from "@/features/tasks/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { AdminShortcuts } from "../AdminShortcuts";
import { ShortcutKeys } from "../ShortcutKeys";
import { matchShortcut } from "../registry";

const openTab = jest.fn();
const togglePanel = jest.fn();
const toggleSidebar = jest.fn();
const togglePalette = jest.fn();
const createTask = jest.fn();
const createIssue = jest.fn();
const createProject = jest.fn();
let kind = "task";
let expanded = true;
jest.mock("@/shared/contexts/AccessoryPanelContext", () => ({
  useAccessoryPanel: () => ({
    openTab,
    toggle: togglePanel,
    expanded,
    activeKey: "active",
    tabs: [{ key: "active", kind, title: "Current" }],
  }),
  accessoryFamily: (value: string) =>
    ({
      task: "tasks",
      issue: "issues",
      project: "projects",
      document: "documents",
    })[value] ?? value,
}));
jest.mock("@/shared/contexts/AdminShellContext", () => ({
  useAdminShell: () => ({ toggleSidebar }),
}));
jest.mock("@/shared/contexts/CommandPaletteContext", () => ({
  useCommandPalette: () => ({
    toggle: togglePalette,
    close: jest.fn(),
    isOpen: false,
  }),
}));
jest.mock("@/shared/contexts/MobileMenuContext", () => ({
  useMobileMenu: () => ({ toggle: jest.fn() }),
}));
jest.mock("@/shared/contexts/QuickActionsContext", () => ({
  useQuickActions: () => ({
    openCreateTaskDialog: createTask,
    openCreateIssueDialog: createIssue,
    openCreateProjectDialog: createProject,
  }),
}));
jest.mock("../NewDocumentDialog", () => ({
  NewDocumentDialog: ({ open }: { open: boolean }) =>
    open ? <div>New document dialog</div> : null,
}));
beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  jest.clearAllMocks();
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  kind = "task";
  expanded = true;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});
function press(code: string, extra = {}) {
  fireEvent.keyDown(window, { code, key: code, altKey: true, ...extra });
}
it.each(["messages", "tasks", "issues", "documents", "projects"] as const)(
  "does not open removed %s collection shortcuts from an editable field",
  (kind) => {
    render(
      <AdminShortcuts>
        <input aria-label="Editor" />
      </AdminShortcuts>,
    );
    screen.getByLabelText("Editor").focus();
    const codes = {
      messages: "KeyM",
      tasks: "KeyT",
      issues: "KeyI",
      documents: "KeyD",
      projects: "KeyP",
    };
    fireEvent.keyDown(screen.getByLabelText("Editor"), {
      code: codes[kind],
      altKey: true,
    });
    expect(openTab).not.toHaveBeenCalled();
  },
);
it("supports Mac Option symbols, Cmd/Ctrl K, and panel toggles", () => {
  render(<AdminShortcuts>Content</AdminShortcuts>);
  press("KeyK", { key: "˚" });
  press("KeyK", { altKey: false, metaKey: true });
  press("KeyK", { altKey: false, ctrlKey: true });
  expect(togglePalette).toHaveBeenCalledTimes(3);
  press("BracketRight", { altKey: false, key: "]" });
  press("BracketLeft", { altKey: false, key: "[" });
  expect(togglePanel).toHaveBeenCalledTimes(1);
  expect(toggleSidebar).toHaveBeenCalledTimes(1);
});
it.each(["task", "issue", "project", "document"])(
  "creates for the active %s detail tab",
  (value) => {
    kind = value;
    render(<AdminShortcuts>Content</AdminShortcuts>);
    press("KeyN");
    if (value === "document")
      expect(screen.getByText("New document dialog")).toBeInTheDocument();
    else
      expect(
        { task: createTask, issue: createIssue, project: createProject }[value],
      ).toHaveBeenCalledTimes(1);
  },
);
it("does not create in a collapsed panel or repeat actions while a key is held", () => {
  expanded = false;
  render(<AdminShortcuts>Content</AdminShortcuts>);
  press("KeyN");
  press("KeyT", { repeat: true });
  expect(createTask).not.toHaveBeenCalled();
  expect(openTab).not.toHaveBeenCalled();
});
it("focuses only the active tab search, skipping hidden preserved tabs", () => {
  render(
    <AdminShortcuts>
      <div hidden>
        <input placeholder="Search hidden" />
      </div>
      <div id="accessory-content-active">
        <input placeholder="Search tasks" />
      </div>
    </AdminShortcuts>,
  );
  const input = screen.getByPlaceholderText("Search tasks");
  jest
    .spyOn(input, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  press("KeyF");
  expect(input).toHaveFocus();
});
it("shows key hints while Alt is held and clears them on release or blur", () => {
  render(
    <AdminShortcuts>
      <ShortcutKeys id="left" />
    </AdminShortcuts>,
  );
  expect(screen.queryByText("[")).toBeNull();
  press("AltLeft");
  expect(screen.getByText("[")).toBeInTheDocument();
  fireEvent.keyUp(window, { key: "Alt", altKey: false });
  expect(screen.queryByText("[")).toBeNull();
  press("AltLeft");
  fireEvent.blur(window);
  expect(screen.queryByText("[")).toBeNull();
});
it("leaves non-palette dialogs and composition to their local controls", () => {
  render(
    <AdminShortcuts>
      <div role="dialog">Dialog</div>
    </AdminShortcuts>,
  );
  press("KeyT");
  expect(openTab).not.toHaveBeenCalled();
  expect(
    matchShortcut(
      new KeyboardEvent("keydown", {
        code: "KeyT",
        altKey: true,
        isComposing: true,
      }),
    ),
  ).toBeUndefined();
});

it("accepts Mac Option even when the browser also reports AltGraph", () => {
  render(<AdminShortcuts>Content</AdminShortcuts>);
  const event = new KeyboardEvent("keydown", {
    code: "KeyK",
    key: "˚",
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "getModifierState", {
    value: (modifier: string) => modifier === "AltGraph",
  });
  fireEvent(window, event);
  expect(togglePalette).toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(true);
});
it("handles app shortcuts before an editor consumes its key events", () => {
  render(
    <AdminShortcuts>
      <input
        aria-label="Editor"
        onKeyDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
      />
    </AdminShortcuts>,
  );
  fireEvent.keyDown(screen.getByLabelText("Editor"), {
    code: "KeyK",
    key: "˚",
    altKey: true,
  });
  expect(togglePalette).toHaveBeenCalled();
});
it.each([
  ["˚", "palette"],
  ["˜", "new"],
  ["ƒ", "search"],
])("recognises Option %s without a physical code", (key, id) => {
  expect(
    matchShortcut(new KeyboardEvent("keydown", { key, altKey: true })),
  ).toBe(id);
});
it("labels the modifier as Option on Mac and Alt on Windows", () => {
  const platform = jest
    .spyOn(navigator, "platform", "get")
    .mockReturnValue("MacIntel");
  const view = render(<ShortcutKeys id="palette" always />);
  expect(screen.getByLabelText("Option+K")).toBeInTheDocument();
  platform.mockReturnValue("Win32");
  view.rerender(<ShortcutKeys id="palette" always />);
  expect(screen.getByLabelText("Alt+K")).toBeInTheDocument();
  platform.mockRestore();
});
it("ignores the closed mobile palette dialog preserved on desktop", () => {
  render(
    <AdminShortcuts>
      <div role="dialog" aria-hidden="true">
        Closed mobile palette
      </div>
    </AdminShortcuts>,
  );
  press("KeyK");
  expect(togglePalette).toHaveBeenCalled();
});

afterEach(() => jest.restoreAllMocks());

const pushPage = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushPage }),
  usePathname: () => "/tasks",
}));
it("navigates with G then T, cancels with Escape, and never navigates while typing", () => {
  render(
    <AdminShortcuts>
      <input aria-label="Title" />
    </AdminShortcuts>,
  );
  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyUp(window, { key: "g" });
  fireEvent.keyDown(window, { key: "t" });
  expect(pushPage).toHaveBeenCalledWith("/tasks");
  pushPage.mockClear();
  fireEvent.keyDown(window, { key: "g" });
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.keyDown(window, { key: "t" });
  expect(pushPage).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByLabelText("Title"), { key: "g" });
  fireEvent.keyDown(screen.getByLabelText("Title"), { key: "t" });
  expect(pushPage).not.toHaveBeenCalled();
});

it("uses the existing status field picker in the focused editor and leaves its search text alone", () => {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
  render(
    <AdminShortcuts>
      <main data-admin-main>
        <StatusEditor />
      </main>
    </AdminShortcuts>,
  );
  fireEvent.keyDown(window, { key: "s" });
  expect(screen.getByRole("combobox")).toBeInTheDocument();
  fireEvent.keyDown(screen.getByRole("combobox"), { key: "s" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
function StatusEditor() {
  const form = useForm<TaskFormData>({
    defaultValues: { status: "todo", priority: 0 },
  });
  return (
    <Form {...form}>
      <TaskStatusField form={form} />
    </Form>
  );
}

it("lets an open menu search with C instead of creating a task", () => {
  render(
    <AdminShortcuts>
      <main data-admin-main>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </main>
    </AdminShortcuts>,
  );
  fireEvent.keyDown(screen.getByRole("menu"), { key: "c" });
  expect(createTask).not.toHaveBeenCalled();
  expect(screen.getByPlaceholderText("Search menu…")).toBeInTheDocument();
});
it("leaves Enter on nested list action buttons alone", () => {
  const open = jest.fn();
  render(
    <AdminShortcuts>
      <main data-admin-main>
        <div data-shortcut-list-item onClick={open}>
          <button>Mark unread</button>
        </div>
      </main>
    </AdminShortcuts>,
  );
  const action = screen.getByRole("button", { name: "Mark unread" });
  action.focus();
  expect(fireEvent.keyDown(action, { key: "Enter" })).toBe(true);
  expect(open).not.toHaveBeenCalled();
});
it("searches the focused primary pane while an accessory tab is open", () => {
  render(
    <AdminShortcuts>
      <main data-admin-main>
        <input placeholder="Primary search" />
      </main>
      <div data-accessory-tab="active" id="accessory-content-active">
        <input placeholder="Accessory search" />
      </div>
    </AdminShortcuts>,
  );
  const primary = screen.getByPlaceholderText("Primary search");
  primary.focus();
  fireEvent.keyDown(primary, { key: "f", code: "KeyF", altKey: true });
  expect(primary).toHaveFocus();
});

it("reveals a closed conversation search in the focused pane with Alt F", () => {
  render(
    <AdminShortcuts>
      <main data-admin-main>
        <ConversationSearch />
      </main>
    </AdminShortcuts>,
  );
  fireEvent.keyDown(window, { key: "f", code: "KeyF", altKey: true });
  expect(screen.getByPlaceholderText("Search this conversation")).toHaveFocus();
});
function ConversationSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button data-shortcut-search onClick={() => setOpen(true)}>
        Search
      </button>
      {open && (
        <input autoFocus type="search" placeholder="Search this conversation" />
      )}
    </>
  );
}
