import { fireEvent, render, screen } from "@testing-library/react";
import { AdminShortcuts } from "../AdminShortcuts";
import { ShortcutKeys } from "../ShortcutKeys";
import { matchShortcut, panelShortcuts } from "../registry";

const openTab = jest.fn();
const togglePanel = jest.fn();
const toggleSidebar = jest.fn();
const togglePalette = jest.fn();
const createTask = jest.fn();
const createIssue = jest.fn();
const createProject = jest.fn();
let kind = "tasks";
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
  jest.clearAllMocks();
  jest
    .spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue([{}] as unknown as DOMRectList);
  kind = "tasks";
  expanded = true;
  window.matchMedia = jest.fn().mockReturnValue({ matches: false });
});
function press(code: string, extra = {}) {
  fireEvent.keyDown(window, { code, key: code, altKey: true, ...extra });
}
it.each(panelShortcuts)(
  "opens %s in the right panel from an editable field",
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
    expect(openTab).toHaveBeenCalledWith({ kind, title: expect.any(String) });
  },
);
it("supports Mac Option symbols, Cmd/Ctrl K, and panel toggles", () => {
  render(<AdminShortcuts>Content</AdminShortcuts>);
  press("KeyK", { key: "˚" });
  press("KeyK", { altKey: false, metaKey: true });
  press("KeyK", { altKey: false, ctrlKey: true });
  expect(togglePalette).toHaveBeenCalledTimes(3);
  press("ArrowRight");
  press("ArrowLeft");
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
  expect(screen.queryByText("←")).toBeNull();
  press("AltLeft");
  expect(screen.getByText("←")).toBeInTheDocument();
  fireEvent.keyUp(window, { key: "Alt", altKey: false });
  expect(screen.queryByText("←")).toBeNull();
  press("AltLeft");
  fireEvent.blur(window);
  expect(screen.queryByText("←")).toBeNull();
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
    code: "KeyM",
    key: "µ",
    altKey: true,
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(event, "getModifierState", {
    value: (modifier: string) => modifier === "AltGraph",
  });
  fireEvent(window, event);
  expect(openTab).toHaveBeenCalledWith({ kind: "messages", title: "Messages" });
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
    code: "KeyT",
    key: "†",
    altKey: true,
  });
  expect(openTab).toHaveBeenCalledWith({ kind: "tasks", title: "Tasks" });
});
it.each([
  ["µ", "messages"],
  ["†", "tasks"],
  ["ˆ", "issues"],
  ["∂", "documents"],
  ["π", "projects"],
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
  const view = render(<ShortcutKeys id="tasks" always />);
  expect(screen.getByLabelText("Option+T")).toBeInTheDocument();
  platform.mockReturnValue("Win32");
  view.rerender(<ShortcutKeys id="tasks" always />);
  expect(screen.getByLabelText("Alt+T")).toBeInTheDocument();
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
  press("KeyT");
  expect(openTab).toHaveBeenCalledWith({ kind: "tasks", title: "Tasks" });
});

afterEach(() => jest.restoreAllMocks());
