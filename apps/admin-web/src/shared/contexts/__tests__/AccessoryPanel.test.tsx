import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccessoryPanelProvider, useAccessoryPanel } from "../AccessoryPanelContext";
import { accessoryDestination } from "@/shared/hooks/usePaneNavigation";
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: "staff-a" } }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/students", useSearchParams: () => new URLSearchParams() }));
function Controls() {
  const panel = useAccessoryPanel()!;
  return <><button onClick={() => panel.openTab({ kind: "tasks", title: "Tasks" })}>Tasks</button><button onClick={() => panel.openTab({ kind: "task", id: "one", title: "First task" })}>Task</button><button onClick={panel.toggle}>Toggle</button><button onClick={() => panel.updateQuery(panel.activeKey!, "search=math&assignee=me")}>Filter</button><button onClick={() => panel.closeTab(panel.activeKey!)}>Close</button><output data-testid="state">{JSON.stringify({ tabs: panel.tabs, activeKey: panel.activeKey, expanded: panel.expanded })}</output></>;
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
