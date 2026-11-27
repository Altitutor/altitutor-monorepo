import React from "react";
import userEvent from "@testing-library/user-event";
import { screen, within } from "@testing-library/react";
import { WeekViewCalendar } from "../WeekViewCalendar";
import { renderWithProviders } from "@/shared/test-utils";
import type { Tables } from "@altitutor/shared";

beforeAll(() => {
  Object.defineProperty(globalThis, "ResizeObserver", {
    value: class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    writable: true,
  });
});

describe("WeekViewCalendar", () => {
  it("shows the replacement session name when opening the weekly session selector", async () => {
    const weekStart = new Date(2026, 8, 7, 0, 0, 0, 0);
    const sessionStart = new Date(2026, 8, 8, 16, 15, 0, 0);
    const sessionEnd = new Date(2026, 8, 8, 17, 45, 0, 0);

    renderWithProviders(
      <WeekViewCalendar
        sessions={[
          {
            id: "session-2",
            start_at: sessionStart.toISOString(),
            end_at: sessionEnd.toISOString(),
            class_id: "class-2",
            type: "CLASS",
            short_name: "12MATH tue 8 Sep 4:15",
            long_name:
              "SACE 12 Mathematical Methods Tuesday 8th Sep 2026 4:15 pm - 5:45 pm",
            class: { short_name: "12MATH tue 4:15" } as Tables<"classes">,
            subject: {
              short_name: "12MATH",
              long_name: "SACE 12 Mathematical Methods",
              name: "Mathematical Methods",
            } as Tables<"subjects">,
          },
        ]}
        selectedSessionIds={new Set()}
        onToggleSession={jest.fn()}
        currentWeekStart={weekStart}
        onWeekChange={jest.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("combobox", { name: "Select sessions" }),
    );
    expect(
      screen.getAllByRole("button", { name: "12MATH tue 8 Sep 4:15" }).length,
    ).toBeGreaterThan(0);
  });

  it("falls back to subject name when generated session names are missing", async () => {
    const weekStart = new Date(2026, 8, 7, 0, 0, 0, 0);
    const sessionStart = new Date(2026, 8, 8, 16, 15, 0, 0);
    const sessionEnd = new Date(2026, 8, 8, 17, 45, 0, 0);

    renderWithProviders(
      <WeekViewCalendar
        sessions={[
          {
            id: "session-2",
            start_at: sessionStart.toISOString(),
            end_at: sessionEnd.toISOString(),
            class_id: "class-2",
            type: "CLASS",
            class: {} as Tables<"classes">,
            subject: {
              name: "Mathematical Methods",
            } as Tables<"subjects">,
          },
        ]}
        selectedSessionIds={new Set()}
        onToggleSession={jest.fn()}
        currentWeekStart={weekStart}
        onWeekChange={jest.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("combobox", { name: "Select sessions" }),
    );
    expect(
      screen.getAllByRole("button", { name: "Mathematical Methods" }).length,
    ).toBeGreaterThan(0);
  });
});


it("groups narrow session choices by time and lets the user select a session chip", async () => {
  const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ x: 0, y: 0, width: 420, height: 440, left: 0, right: 420, top: 0, bottom: 440, toJSON: () => ({}) });
  const choose = jest.fn();
  try {
    const session = (id: string, hour: number) => ({
      id,
      start_at: new Date(2026, 8, 8, hour).toISOString(),
      end_at: new Date(2026, 8, 8, hour + 1).toISOString(),
      type: "CLASS" as const,
      class_id: null,
      short_name: id,
    });
    renderWithProviders(
      <WeekViewCalendar
        sessions={[session("Biology", 17), session("Mathematics", 15)]}
        selectedSessionIds={new Set(["Biology"])}
        onToggleSession={choose}
        currentWeekStart={new Date(2026, 8, 7)}
        onWeekChange={jest.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Select sessions" }));
    const list = within(await screen.findByLabelText("Daily session list"));
    await userEvent.click(list.getByRole("button", { name: /Tue 8/ }));
    const maths = list.getByRole("button", { name: "Mathematics", pressed: false });
    const biology = list.getByRole("button", { name: "Biology", pressed: true });
    expect(maths.compareDocumentPosition(biology) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(list.getByText("3:00 pm")).toBeVisible();
    expect(list.getByText("5:00 pm")).toBeVisible();
    await userEvent.click(maths);
    expect(choose).toHaveBeenCalledWith("Mathematics");
  } finally {
    bounds.mockRestore();
  }
});
