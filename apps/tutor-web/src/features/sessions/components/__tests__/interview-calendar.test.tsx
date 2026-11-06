import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import { SessionsCalendarView } from "../SessionsCalendarView";
import { TutorTodaySessionsCalendarView } from "../TutorTodaySessionsCalendarView";
import { useAuthStore } from "@/shared/lib/supabase/auth";

Object.assign(globalThis, { React });
const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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


it.each([true, false])("retries failed calendar access before loading rounds (allowed=%s)", async (hasAccess) => {
  useAuthStore.setState({ user: { id: "retry-actor", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-28T00:00:00Z" }, loading: false });
  const client = new QueryClient({defaultOptions: {queries: {staleTime: Infinity, retry: false}}});
  client.setQueryData(["sessions", "list"], []);
  client.setQueryData(["staff", "current", "retry-actor"], {id: "assigned-tutor"});
  let accessRequests = 0;
  let roundRequests = 0;
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (input) => {
    if (String(input) === "/api/interviews/access") {
      accessRequests++;
      return {ok: accessRequests > 1, status: accessRequests > 1 ? 200 : 503, json: async () => ({hasAccess})} as Response;
    }
    if (String(input) === "/api/interviews/rounds") {
      roundRequests++;
      return {ok: true, json: async () => []} as unknown as Response;
    }
    throw new Error(`Unexpected request: ${String(input)}`);
  });
  const view = render(<QueryClientProvider client={client}><SessionsCalendarView /></QueryClientProvider>);
  try {
    fireEvent.click(await screen.findByRole("button", {name: "Retry"}));
    await waitFor(() => expect(screen.queryByRole("button", {name: "Retry"})).not.toBeInTheDocument());
    expect(accessRequests).toBe(2);
    expect(roundRequests).toBe(hasAccess ? 1 : 0);
  } finally {
    view.unmount();
    client.clear();
    global.fetch = originalFetch;
    useAuthStore.setState({user: null, loading: true});
  }
});

it("shows the Adelaide time used by the dashboard grid in the interview tooltip", async () => {
  useAuthStore.setState({ user: null, loading: true });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const scheduledAt = "2026-11-06T04:00:00.000Z";
  client.setQueryData(["staff", "current", null], { id: "assigned-tutor" });
  client.setQueryData(["interviews", "access", undefined], true);
  client.setQueryData(
    ["interviews", "rounds", undefined],
    [
      {
        id: "dashboard-round",
        name: "Afternoon interview",
        scheduledAt,
        startedAt: null,
        phase: "waiting",
        delivery: "online",
        mode: "exam",
        recordingEnabled: false,
        readingTimeSeconds: 60,
        questionTimeSeconds: 480,
        stations: [{ id: "station" }],
        students: [],
        tutors: [{ id: "assigned-tutor", name: "Assigned tutor" }],
      },
    ],
  );

  render(
    <QueryClientProvider client={client}>
      <TutorTodaySessionsCalendarView
        date={format(new Date(scheduledAt), "yyyy-MM-dd")}
        sessions={[]}
      />
    </QueryClientProvider>,
  );
  fireEvent.focus(
    screen.getByRole("button", { name: "Interview round Afternoon interview" }),
  );

  const tooltip = await screen.findByRole("tooltip");
  expect(tooltip).toHaveTextContent("2:30");
  expect(tooltip).toHaveTextContent(/3:00 pm/i);
  client.clear();
});
