import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccessoryPanelProvider, useAccessoryPanel } from "../AccessoryPanelContext";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: "staff-a" } }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/students", useSearchParams: () => new URLSearchParams() }));
function Controls() {
  const panel = useAccessoryPanel()!;
  return (
    <>
      <button onClick={() => panel.openTab({ kind: "tasks", title: "Tasks" })}>Tasks</button>
      <button onClick={() => panel.openTab({ kind: "task", id: "one", title: "First task" })}>Task</button>
      <button onClick={() => panel.openTab({ kind: "messages", title: "Messages" })}>Messages</button>
      <button
        onClick={() =>
          panel.openTab({
            kind: "messages",
            id: "person",
            title: "Person",
            query: "contact=person",
          })
        }
      >
        Conversation
      </button>
      <button
        onClick={() => panel.updateQuery(panel.activeKey!, "contact=person")}
      >
        Open conversation query
      </button>
      <button onClick={panel.toggle}>Toggle</button>
      <button onClick={() => panel.updateQuery(panel.activeKey!, "search=math&assignee=me")}>Filter</button>
      <button onClick={() => panel.closeTab(panel.activeKey!)}>Close</button>
      <button onClick={() => panel.recentlyClosed[0] && panel.openTab(panel.recentlyClosed[0])}>Reopen</button>
      <output data-testid="state">{JSON.stringify({ tabs: panel.tabs, recentlyClosed: panel.recentlyClosed, activeKey: panel.activeKey, expanded: panel.expanded })}</output>
    </>
  );
}
const state = () => JSON.parse(screen.getByTestId("state").textContent!);
beforeEach(() => { localStorage.clear(); Object.defineProperty(crypto, "randomUUID", { configurable: true, value: () => `tab-${Math.random()}` }); });
test("collapsing and reopening preserves tab order, selection and filters", async () => {
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Tasks")); fireEvent.click(screen.getByText("Task")); fireEvent.click(screen.getByText("Filter"));
  const before = state(); fireEvent.click(screen.getByText("Toggle")); expect(state().expanded).toBe(false); fireEvent.click(screen.getByText("Toggle")); expect(state()).toEqual(before);
});
test("opening an existing record focuses it without adding a duplicate or resetting filters", async () => {
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Tasks")); fireEvent.click(screen.getByText("Filter")); const key = state().activeKey;
  fireEvent.click(screen.getByText("Task")); fireEvent.click(screen.getByText("Tasks"));
  expect(state().tabs).toHaveLength(2); expect(state().activeKey).toBe(key); expect(state().tabs[0].query).toContain("search=math");
});
test("closing active tab selects its neighbour and removes only that tab", async () => {
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Tasks")); const key = state().activeKey; fireEvent.click(screen.getByText("Task")); fireEvent.click(screen.getByText("Close"));
  expect(state().tabs).toHaveLength(1); expect(state().activeKey).toBe(key);
});
test("restores browser-local tabs and selected filters after remount", async () => {
  const first = render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Tasks")); fireEvent.click(screen.getByText("Filter")); const before = state();
  await waitFor(() => expect(localStorage.getItem("admin-accessory-v1:staff-a")).toContain("search=math")); first.unmount();
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  await waitFor(() => expect(state()).toEqual(before));
});
test("corrupt stored workspace does not prevent rendering", async () => {
  localStorage.setItem("admin-accessory-v1:staff-a", "invalid"); render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  await act(async () => {}); expect(state().tabs).toEqual([]);
});
test("destination rule identifies accessory records and conversation links", () => {
  expect(accessoryDestination("/tasks/one")).toMatchObject({ kind: "task", id: "one" });
  expect(accessoryDestination("/messages?contact=person")).toMatchObject({ kind: "messages", id: "person", query: "contact=person" });
  expect(accessoryDestination("/students/one")).toBeNull(); expect(accessoryDestination("/invoices/one")).toBeNull();
});
test("opening Messages focuses a conversation-list tab, not an open conversation", async () => {
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Conversation"));
  const conversationKey = state().activeKey;
  expect(state().tabs).toHaveLength(1);
  expect(state().tabs[0]).toMatchObject({ kind: "messages", id: "person", query: "contact=person" });

  fireEvent.click(screen.getByText("Messages"));
  expect(state().tabs).toHaveLength(2);
  expect(state().activeKey).not.toBe(conversationKey);
  const listTab = state().tabs.find((tab: { key: string }) => tab.key === state().activeKey);
  expect(listTab).toMatchObject({
    kind: "messages",
    query: "",
    title: "Messages",
  });
  expect(listTab.id).toBeUndefined();

  const listKey = state().activeKey;
  fireEvent.click(screen.getByText("Messages"));
  expect(state().tabs).toHaveLength(2);
  expect(state().activeKey).toBe(listKey);
});
test("selecting a conversation updates the messages tab id so list open stays separate", async () => {
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(await screen.findByText("Messages"));
  fireEvent.click(screen.getByText("Open conversation query"));
  expect(state().tabs[0]).toMatchObject({ kind: "messages", id: "person", query: "contact=person" });

  fireEvent.click(screen.getByText("Messages"));
  expect(state().tabs).toHaveLength(2);
  expect(state().tabs.map((tab: { query: string }) => tab.query)).toEqual([
    "contact=person",
    "",
  ]);
});


test("recently closed tabs persist and reopen with their filters and conversation", async () => {
  const first = render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  fireEvent.click(screen.getByText("Conversation"));
  const originalKey = state().activeKey;
  fireEvent.click(screen.getByText("Close"));
  expect(state().recentlyClosed[0]).toMatchObject({ kind: "messages", id: "person", query: "contact=person" });
  await waitFor(() => expect(localStorage.getItem("admin-accessory-v1:staff-a")).toContain("recentlyClosed"));
  first.unmount();
  render(<AccessoryPanelProvider><Controls /></AccessoryPanelProvider>);
  expect(state().recentlyClosed).toHaveLength(1);
  fireEvent.click(screen.getByText("Reopen"));
  expect(state().tabs[0]).toMatchObject({ kind: "messages", id: "person", query: "contact=person" });
  expect(state().activeKey).not.toBe(originalKey);
  expect(state().recentlyClosed).toHaveLength(0);
});

test("recently closed is newest first and contains only the last ten unique tabs", () => {
  function Bulk() {
    const panel = useAccessoryPanel()!;
    return <><button onClick={() => { for (let n = 0; n < 12; n++) panel.openTab({ kind: "task", id: String(n), title: `Task ${n}` }); }}>Open all</button>
      <button onClick={() => { for (const tab of panel.tabs) panel.closeTab(tab.key); }}>Close all</button>
      <output data-testid="recent">{JSON.stringify(panel.recentlyClosed)}</output></>;
  }
  render(<AccessoryPanelProvider><Bulk /></AccessoryPanelProvider>);
  fireEvent.click(screen.getByText("Open all"));
  fireEvent.click(screen.getByText("Close all"));
  const recent = JSON.parse(screen.getByTestId("recent").textContent!);
  expect(recent).toHaveLength(10);
  expect(recent[0].id).toBe("11");
  expect(recent[9].id).toBe("2");
});
