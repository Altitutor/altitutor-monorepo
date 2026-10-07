import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccessoryTabPicker } from "../AccessoryTabPicker";

const mockOpenTab = jest.fn();
const recent = {
  key: "closed",
  kind: "task",
  id: "recent",
  title: "Recent task",
  query: "view=board",
  locations: {
    "tasks:": { kind: "tasks", title: "Tasks", query: "assignee=me" },
  },
};
jest.mock("@/shared/contexts/AccessoryPanelContext", () => ({
  accessoryFamily: (kind: string) =>
    (
      ({
        task: "tasks",
        issue: "issues",
        project: "projects",
        document: "documents",
      }) as Record<string, string>
    )[kind] ?? kind,
  useAccessoryPanel: () => ({ openTab: mockOpenTab, recentlyClosed: [recent] }),
}));
jest.mock("@/features/messages/api/queries", () => ({
  useUnreadConversationCount: () => ({ data: 2 }),
  useConversationList: () => ({ data: [] }),
}));
jest.mock("@/shared/hooks/useEntitySearch", () => ({
  useEntitySearch: ({ search }: { search: string }) => ({
    results:
      search === "work"
        ? [
            {
              type: "task",
              id: "active",
              data: { title: "Active work", status: "todo" },
            },
            {
              type: "task",
              id: "done",
              data: { title: "Finished work", status: "done" },
            },
            {
              type: "issue",
              id: "resolved",
              data: { name: "Resolved work", status: "resolved" },
            },
            {
              type: "project",
              id: "completed",
              data: { name: "Completed work", status: "completed" },
            },
          ]
        : [],
    isLoading: false,
    hasError: false,
  }),
}));

beforeEach(() => {
  mockOpenTab.mockClear();
  Element.prototype.scrollIntoView = jest.fn();
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

it("shows recently closed below views and restores all saved tab state", async () => {
  const user = userEvent.setup();
  render(<AccessoryTabPicker />);
  await user.click(screen.getByRole("button", { name: "Add accessory tab" }));
  expect(screen.getByText("Views")).toBeInTheDocument();
  expect(screen.getByText("Recently closed")).toBeInTheDocument();
  await user.click(screen.getByRole("option", { name: "Recent task" }));
  expect(mockOpenTab).toHaveBeenCalledWith(recent);
});

it("hides completed work and groups with no matches", async () => {
  const user = userEvent.setup();
  render(<AccessoryTabPicker />);
  await user.click(screen.getByRole("button", { name: "Add accessory tab" }));
  await user.type(screen.getByRole("combobox"), "work");
  expect(screen.getByText("Active work")).toBeInTheDocument();
  for (const title of [
    "Finished work",
    "Resolved work",
    "Completed work",
    "Views",
    "Recently closed",
    "Conversations",
  ]) {
    expect(screen.queryByText(title)).not.toBeInTheDocument();
  }
  await user.clear(screen.getByRole("combobox"));
  await user.type(screen.getByRole("combobox"), "nothing");
  expect(screen.queryByText("Records")).not.toBeInTheDocument();
  expect(screen.getByText("No results found.")).toBeInTheDocument();
});
