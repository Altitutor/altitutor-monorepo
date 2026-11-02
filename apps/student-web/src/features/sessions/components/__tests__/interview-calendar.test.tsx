import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { StudentTodaySessionsCalendarView } from "../StudentTodaySessionsCalendarView";
import { StudentSessionsCalendarView } from "../StudentSessionsCalendarView";
import { useAuthStore } from "@/shared/lib/supabase/auth";

Object.assign(globalThis, { React });
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

it("shows the student their online interview and links to its guarded room", () => {
  useAuthStore.setState({ user: null, loading: true });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const today = new Date(new Date().setHours(10, 0, 0, 0));
  client.setQueryData(
    [
      "student",
      "sessions",
      format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    ],
    [],
  );
  client.setQueryData(["interviews", "access", undefined], { hasAccess: true });
  client.setQueryData(
    ["interviews", "rounds", undefined],
    [
      {
        id: "student-circuit",
        name: "Online circuit",
        scheduledAt: today.toISOString(),
        scheduledEndAt: new Date(today.getTime() + 54 * 60_000).toISOString(),
        startedAt: null,
        phase: "waiting",
        delivery: "online",
        mode: "exam",
        stations: [{ id: "station-1", number: 1 }],
        result: null,
      },
    ],
  );
  render(
    <QueryClientProvider client={client}>
      <StudentSessionsCalendarView />
    </QueryClientProvider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Interview round Online circuit" }),
  );
  expect(screen.getByRole("dialog")).toHaveTextContent("Online circuit");
  expect(
    screen.getByRole("link", { name: "Enter waiting room" }),
  ).toHaveAttribute("href", "/interviews/rounds/student-circuit");
  client.clear();
});

function renderToday(overrides: Record<string, unknown>, hasAccess = true) {
  useAuthStore.setState({ user: null, loading: true });
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const today = new Date(new Date().setHours(23, 40, 0, 0));
  client.setQueryData(["interviews", "access", undefined], { hasAccess });
  client.setQueryData(
    ["interviews", "rounds", undefined],
    [
      {
        id: "late-round",
        name: "Late interview",
        scheduledAt: today.toISOString(),
        scheduledEndAt: new Date(today.getTime() + 54 * 60_000).toISOString(),
        startedAt: null,
        phase: "waiting",
        delivery: "online",
        stations: [{ id: "station-1" }],
        result: null,
        ...overrides,
      },
    ],
  );
  const view = render(
    <QueryClientProvider client={client}>
      <StudentTodaySessionsCalendarView
        date={format(today, "yyyy-MM-dd")}
        sessions={[]}
      />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

it.each([
  [
    { startedAt: "2026-10-28T12:00:00Z", phase: "questions" },
    "Rejoin interview",
    "/interviews/rounds/late-round",
  ],
  [
    { phase: "completed", result: { revision: 1 } },
    "View results",
    "/interviews/rounds/late-round/results",
  ],
])(
  "keeps an after-hours round reachable with the right lifecycle action",
  (overrides, label, href) => {
    const { client } = renderToday(overrides);
    fireEvent.click(
      screen.getByRole("button", { name: "Interview round Late interview" }),
    );
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
    client.clear();
  },
);

it.each([{ phase: "completed", result: null }, { delivery: "in_person" }])(
  "never offers an online join for an in-person or completed round",
  (overrides) => {
    const { client } = renderToday(overrides);
    fireEvent.click(
      screen.getByRole("button", { name: "Interview round Late interview" }),
    );
    expect(
      screen.queryByRole("link", { name: /waiting|rejoin|results/i }),
    ).not.toBeInTheDocument();
    client.clear();
  },
);

it("hides cached interview rounds after enrolment access is lost", () => {
  const { client } = renderToday({}, false);
  expect(
    screen.queryByRole("button", { name: "Interview round Late interview" }),
  ).not.toBeInTheDocument();
  client.clear();
});


it.each([true, false])("retries failed calendar access before loading rounds (allowed=%s)", async (hasAccess) => {
  useAuthStore.setState({ user: { id: "retry-actor", aud: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-28T00:00:00Z" }, loading: false });
  const client = new QueryClient({defaultOptions: {queries: {staleTime: Infinity, retry: false}}});
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
  const view = render(<QueryClientProvider client={client}><StudentTodaySessionsCalendarView date={format(new Date(), "yyyy-MM-dd")} sessions={[]} /></QueryClientProvider>);
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
