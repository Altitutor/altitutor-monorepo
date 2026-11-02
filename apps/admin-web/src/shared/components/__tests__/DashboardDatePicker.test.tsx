import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DashboardDatePicker } from "../layouts/DashboardDatePicker";
import {
  AccessoryPanelProvider,
  useAccessoryPanel,
} from "@/shared/contexts/AccessoryPanelContext";

const push = jest.fn();
jest.mock('next/navigation', () => ({useRouter: () => ({push}), usePathname: () => '/dashboard/2026-10-03'}));
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
  push.mockClear();
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
test("day selection navigates the main dashboard without creating an accessory view", async () => {
  const user = setup();
  await user.click(screen.getByRole('button', {name: 'Open calendar'}));
  await user.click(screen.getByRole('button', {name: 'Monday, 5 October 2026'}));
  expect(push).toHaveBeenCalledWith('/dashboard/2026-10-05');
  expect(workspace().tabs).toEqual([]);
});
