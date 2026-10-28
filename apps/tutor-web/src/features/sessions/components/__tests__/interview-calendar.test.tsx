import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionsCalendarView } from "../SessionsCalendarView";
import { useAuthStore } from "@/shared/lib/supabase/auth";

Object.assign(globalThis, { React });
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

it("opens an assigned interview from the weekly calendar into its waiting room", () => {
  useAuthStore.setState({ user: null, loading: true });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["sessions", "list"], []);
  client.setQueryData(["staff", "current", null], { id: "assigned-tutor" });
  client.setQueryData(["interviews", "access", undefined], true);
  client.setQueryData(
    ["interviews", "rounds", undefined],
    [
      {
        id: "round-calendar",
        name: "Practice circuit",
        scheduledAt: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
        startedAt: null,
        phase: "waiting",
        delivery: "online",
        mode: "exam",
        recordingEnabled: false,
        readingTimeSeconds: 60,
        questionTimeSeconds: 480,
        stations: [{ id: "station-1" }],
        students: [],
        tutors: [{ id: "assigned-tutor", name: "Assigned tutor" }],
      },
    ],
  );
  render(
    <QueryClientProvider client={client}>
      <SessionsCalendarView />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Interview round Practice circuit" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("Practice circuit");
  fireEvent.click(screen.getByRole("button", { name: "Open waiting room" }));
  expect(push).toHaveBeenCalledWith(
    "/interviews/rounds/round-calendar/waiting",
  );
  client.clear();
});

it("does not show a round merely created by this tutor when they are not assigned to it", () => {
  useAuthStore.setState({ user: null, loading: true });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(["sessions", "list"], []);
  client.setQueryData(["staff", "current", null], { id: "current-tutor" });
  client.setQueryData(["interviews", "access", undefined], true);
  client.setQueryData(
    ["interviews", "rounds", undefined],
    [
      {
        id: "created-round",
        name: "Other tutors circuit",
        createdBy: "current-tutor",
        scheduledAt: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
        startedAt: null,
        phase: "waiting",
        delivery: "online",
        mode: "exam",
        recordingEnabled: false,
        readingTimeSeconds: 60,
        questionTimeSeconds: 480,
        stations: [{ id: "station" }],
        students: [],
        tutors: [{ id: "other-tutor", name: "Other tutor" }],
      },
    ],
  );
  render(
    <QueryClientProvider client={client}>
      <SessionsCalendarView />
    </QueryClientProvider>,
  );
  expect(
    screen.queryByRole("button", {
      name: "Interview round Other tutors circuit",
    }),
  ).not.toBeInTheDocument();
  client.clear();
});
