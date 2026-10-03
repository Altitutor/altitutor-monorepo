import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TodayView } from "../TodayView";
import { useAccessoryTitle } from "@/shared/hooks/useAccessoryTitle";
jest.mock("@/shared/hooks/useAccessoryTitle", () => ({
  useAccessoryTitle: jest.fn(),
}));
jest.mock("@/shared/contexts/EntityNavigation", () => ({
  useEntityNavigation: () => ({ openSession: jest.fn() }),
}));
jest.mock("@/shared/hooks/useUrlQueryParam", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  return { useUrlQueryParam: () => React.useState("") };
});
jest.mock("@/features/sessions/components/TodaySessionsCalendarView", () => ({
  TodaySessionsCalendarView: ({ date }: { date: string }) => (
    <output data-testid="calendar-date">{date}</output>
  ),
}));
beforeEach(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = jest.fn();
  jest.useFakeTimers().setSystemTime(new Date("2026-10-03T12:00:00"));
  jest.mocked(useAccessoryTitle).mockClear();
});
afterEach(() => jest.useRealTimers());
test("day arrows change the calendar and tab title, returning to today restores Today", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<TodayView />);
  expect(screen.getByTestId("calendar-date")).toHaveTextContent("2026-10-03");
  expect(useAccessoryTitle).toHaveBeenLastCalledWith("Today");
  await user.click(screen.getByRole("button", { name: "Next day" }));
  expect(screen.getByTestId("calendar-date")).toHaveTextContent("2026-10-04");
  expect(useAccessoryTitle).toHaveBeenLastCalledWith("4 Oct");
  await user.click(screen.getByRole("button", { name: "Previous day" }));
  expect(useAccessoryTitle).toHaveBeenLastCalledWith("Today");
});
test("clicking the date accepts a natural-language day", async () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  render(<TodayView />);
  await user.click(screen.getByRole("button", { name: "Choose calendar day" }));
  const input = screen.getByRole("combobox");
  await user.type(input, "5 Oct");
  await user.click(await screen.findByRole("option", { name: /Use "5 Oct"/ }));
  expect(screen.getByTestId("calendar-date")).toHaveTextContent("2026-10-05");
  expect(useAccessoryTitle).toHaveBeenLastCalledWith("5 Oct");
});
