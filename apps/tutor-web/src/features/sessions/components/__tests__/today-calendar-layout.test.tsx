import React from "react";
import { render, fireEvent } from "@testing-library/react";
import type { Database } from "@altitutor/shared";
import { TutorTodaySessionsCalendarView } from "../TutorTodaySessionsCalendarView";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock("../../hooks/useSessionsQuery", () => ({
  useTutorSessionDetailsBatch: () => ({ data: {} }),
}));
jest.mock("@/features/interviews/hooks/use-interviews", () => ({
  useInterviewCalendarRounds: () => ({ data: [], isPending: false }),
}));
jest.mock("@/shared/hooks/useElementSize", () => ({
  useElementSize: () => [jest.fn(), { width: 800, height: 300 }],
}));

it("stacks successive trials beside a long shift and keeps session selection", () => {
  type Session = Database["public"]["Views"]["vtutor_sessions"]["Row"];
  const session = (id: string, start: string, end: string): Session =>
    ({
      session_id: id,
      session_type: id === "shift" ? "ADMIN_SHIFT" : "TRIAL_SESSION",
      start_at: `2026-11-05T${start}:00+10:30`,
      end_at: `2026-11-05T${end}:00+10:30`,
    }) as Session;
  const onOpenSession = jest.fn();
  const { container } = render(
    <TutorTodaySessionsCalendarView
      date="2026-11-05"
      sessions={[
        session("shift", "16:00", "19:00"),
        session("trial-1", "16:00", "17:00"),
        session("trial-2", "17:00", "18:00"),
      ]}
      onOpenSession={onOpenSession}
    />,
  );
  const blocks = Array.from(
    container.querySelectorAll<HTMLElement>('[style*="min-height: 45px"]'),
  );
  expect(blocks).toHaveLength(3);
  expect(blocks[1].style.left).toBe(blocks[2].style.left);
  expect(blocks[1].style.width).toBe("47.5%");
  expect(blocks[0].style.left).not.toBe(blocks[1].style.left);
  fireEvent.click(blocks[2].querySelector("[class]")!);
  expect(onOpenSession).toHaveBeenCalledWith("trial-2");
});
