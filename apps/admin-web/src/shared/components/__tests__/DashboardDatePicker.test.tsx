import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardDatePicker } from "../layouts/DashboardDatePicker";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";

jest.mock("@/shared/lib/supabase/auth", () => ({
  useAuthStore: () => ({ user: { id: "calendar-test" } }),
}));
function Harness() {
  const panel = useAccessoryPanel();
  return (
    <>
      <DashboardDatePicker />
      <button onClick={() => panel?.collapse()}>Collapse panel</button>
      <output data-testid="workspace">{JSON.stringify(panel)}</output>
    </>
  );
}
const workspace = () =>
  JSON.parse(screen.getByTestId("workspace").textContent!);
beforeEach(() => {
  localStorage.clear();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-03T12:00:00"));
  Object.defineProperty(crypto, "randomUUID", {
    configurable: true,
    value: () => "calendar-key",
  });
});
afterEach(() => jest.useRealTimers());
const setup = () => {
  render(
    <AccessoryPanelProvider>
      <Harness />
    </AccessoryPanelProvider>,
  );
  return userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
};
test("the header calendar shows one month with numbered days and navigates whole months", async () => {
  const user = setup();
  await user.click(screen.getByRole("button", { name: "Open calendar" }));
  expect(screen.getByRole("group", { name: "October 2026" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: /October 2026$/ })).toHaveLength(
    31,
  );
  expect(
    screen.getByRole("button", { name: "Monday, 5 October 2026" }),
  ).toHaveTextContent("5");
  await user.click(screen.getByRole("button", { name: "Previous month" }));
  expect(screen.getByRole("group", { name: "September 2026" })).toBeVisible();
  expect(
    screen.getAllByRole("button", { name: /September 2026$/ }),
  ).toHaveLength(30);
  await user.click(screen.getByRole("button", { name: "Next month" }));
  expect(screen.getByRole("group", { name: "October 2026" })).toBeVisible();
});
test("day selection opens and reuses Today, changes its date, and expands a collapsed panel", async () => {
  const user = setup();
  await user.click(screen.getByRole("button", { name: "Open calendar" }));
  await user.click(
    screen.getByRole("button", { name: "Monday, 5 October 2026" }),
  );
  expect(workspace()).toMatchObject({
    expanded: true,
    activeKey: "calendar-key",
    tabs: [{ kind: "today", title: "5 Oct", query: "date=2026-10-05" }],
  });
  await user.click(screen.getByRole("button", { name: "Collapse panel" }));
  await user.click(screen.getByRole("button", { name: "Open calendar" }));
  await user.click(
    screen.getByRole("button", { name: "Tuesday, 6 October 2026" }),
  );
  expect(workspace().tabs).toHaveLength(1);
  expect(workspace()).toMatchObject({
    expanded: true,
    tabs: [{ key: "calendar-key", title: "6 Oct", query: "date=2026-10-06" }],
  });
  await user.click(screen.getByRole("button", { name: "Open calendar" }));
  await user.click(
    screen.getByRole("button", { name: "Saturday, 3 October 2026" }),
  );
  expect(workspace().tabs[0]).toMatchObject({ title: "Today", query: "" });
});
