/** @jest-environment jsdom */
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { TimedCalendar } from "../timed-calendar";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it("stacks back-to-back trials beside a long shift in the same column", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const date = new Date(2026, 10, 5);
  const at = (hour: number) => new Date(2026, 10, 5, hour).toISOString();
  try {
    await act(async () =>
      root.render(
        <TimedCalendar
          dates={[date]}
          events={[
            { id: "shift", startAt: at(16), endAt: at(19), value: "Shift" },
            { id: "trial-1", startAt: at(16), endAt: at(17), value: "Trial 1" },
            { id: "trial-2", startAt: at(17), endAt: at(18), value: "Trial 2" },
          ]}
          renderEvent={(value) => <button>{value}</button>}
        />,
      ),
    );
    const event = (id: string) => {
      const element = container.querySelector<HTMLElement>(
        `[data-calendar-event="${id}"]`,
      );
      if (!element) throw new Error(`Missing calendar event ${id}`);
      return element;
    };
    expect(event("trial-1").style.left).toBe(event("trial-2").style.left);
    expect(event("trial-1").style.width).toBe("47.5%");
    expect(event("shift").style.left).not.toBe(event("trial-1").style.left);
    expect(event("trial-1").style.top).not.toBe(event("trial-2").style.top);
  } finally {
    await act(async () => root.unmount());
  }
});
