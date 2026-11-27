import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInterviewRound, useInterviewCommand, useInterviewPrintRound } from "../use-interviews";

jest.mock("@/features/staff/hooks/useStaffQuery", () => ({ useCurrentStaff: jest.fn() }));
jest.mock("../use-interview-access", () => ({ useInterviewAccess: jest.fn() }));
let actorId = "actor";
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: actorId }, loading: false }) }));
jest.mock("@altitutor/ui", () => ({ useToast: () => ({ toast: jest.fn() }) }));
let changed: () => void;
let subscriptionStatus: (status: string) => void;
let connectOnSubscribe = false;
const mockSubscribe = jest.fn((status: (status: string) => void) => {
  subscriptionStatus = status;
  if (connectOnSubscribe) status("SUBSCRIBED");
  return {};
});
jest.mock("@/shared/lib/supabase/client", () => ({
  getSupabaseClient: () => ({
    channel: () => ({
      on: (_type: string, _filter: unknown, callback: () => void) => {
        changed = callback;
        return { subscribe: mockSubscribe };
      },
    }),
    removeChannel: jest.fn(),
  }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const response = (version: number, live = true) => ({ ok: true, json: async () => {
  const round = { id: "round", version, phase: "waiting", pausedAt: null, phaseDeadline: null, serverNow: "2026-11-20T00:00:00Z" };
  return live ? { round, actorId: "tutor", contentRevision: "a".repeat(32), stations: [] } : round;
} }) as Response;

test("a live room connects once and reads once for a reconnect with foreground events", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const hidden = jest.spyOn(document, "hidden", "get").mockReturnValue(false);
  const read = jest.fn().mockResolvedValue(response(1));
  global.fetch = jest.fn((input: RequestInfo | URL) =>
    String(input).endsWith("/commands") ? Promise.resolve(response(1)) : read(),
  );
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  mockSubscribe.mockClear();
  connectOnSubscribe = true;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));

    await act(async () => {
      subscriptionStatus("CHANNEL_ERROR");
      subscriptionStatus("SUBSCRIBED");
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(read).toHaveBeenCalledTimes(3);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  } finally {
    view.unmount();
    client.clear();
    hidden.mockRestore();
    connectOnSubscribe = false;
  }
});

test("a burst of realtime changes keeps one HTTP read in flight and reads the latest trailing state", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const first = deferred<Response>();
  const tail = deferred<Response>();
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockReturnValueOnce(first.promise).mockReturnValueOnce(tail.promise);
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.version).toBe(1));
    act(() => { changed(); });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    act(() => { for (let i = 0; i < 20; i++) changed(); void view.result.current.refetch(); });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => first.resolve(response(2)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    await act(async () => tail.resolve(response(3)));
    await waitFor(() => expect(view.result.current.data?.version).toBe(3));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  } finally { view.unmount(); client.clear(); }
});

test("an action waits for a new snapshot after an older read already began", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const old = deferred<Response>();
  const fresh = deferred<Response>();
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise);
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.version).toBe(1));
    act(() => changed());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    let version: number | undefined;
    let action: Promise<void>;
    act(() => { action = view.result.current.refreshForAction().then((value) => { version = value.version; }); });
    await act(async () => old.resolve(response(2)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(version).toBeUndefined();
    await act(async () => { fresh.resolve(response(3)); await action; });
    expect(version).toBe(3);
  } finally { view.unmount(); client.clear(); }
});


test("cache removal discards a queued trailing read", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const old = deferred<Response>();
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockReturnValueOnce(old.promise);
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  await waitFor(() => expect(view.result.current.data?.version).toBe(1));
  act(() => { changed(); changed(); });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  view.unmount();
  client.clear();
  await act(async () => old.resolve(response(2)));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(client.getQueryCache().getAll()).toHaveLength(0);
});

test("switching actors cannot run the old actor's queued read or replace the new snapshot", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const old = deferred<Response>();
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockReturnValueOnce(old.promise).mockResolvedValue(response(9));
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.version).toBe(1));
    act(() => { changed(); changed(); });
    actorId = "other";
    view.rerender();
    await waitFor(() => expect(view.result.current.data?.version).toBe(9));
    await act(async () => old.resolve(response(2)));
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(view.result.current.data?.version).toBe(9);
  } finally { actorId = "actor"; view.unmount(); client.clear(); }
});

test("a saved action settles after its fresh pass despite later realtime changes", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const old = deferred<Response>();
  const fresh = deferred<Response>();
  const later = deferred<Response>();
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise).mockReturnValueOnce(later.promise);
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => ({ round: useInterviewRound("round", true), command: useInterviewCommand() }), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.round.data?.version).toBe(1));
    act(() => changed());
    let settled = false;
    act(() => { void view.result.current.command.mutateAsync({ type: "pause", roundId: "round", commandId: "command", expectedVersion: 1 }).then(() => { settled = true; }); });
    // Allow the command acknowledgment to request its post-save barrier.
    await act(async () => { await Promise.resolve(); });
    await act(async () => old.resolve(response(2)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    act(() => changed());
    await act(async () => fresh.resolve(response(3)));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(settled).toBe(true));
    await act(async () => later.resolve(response(4)));
    await waitFor(() => expect(view.result.current.round.data?.version).toBe(4));
  } finally { view.unmount(); client.clear(); }
});

test("a failed recovery read cannot supply the old cached snapshot to an action", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fetchMock = jest.fn().mockResolvedValueOnce(response(1)).mockResolvedValue({ ok: false, json: async () => ({ error: "Database unavailable" }) } as Response);
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : fetchMock());
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.version).toBe(1));
    await act(async () => { await expect(view.result.current.refreshForAction()).rejects.toThrow("Database unavailable"); });
    expect(view.result.current.data?.version).toBe(1);
  } finally { view.unmount(); client.clear(); }
});

 test("printing reads the rich round only on demand and does not subscribe to live refreshes", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  global.fetch = jest.fn().mockResolvedValue(response(4, false));
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(({ id }) => useInterviewPrintRound(id), { initialProps: { id: "" }, wrapper });
  try {
    expect(global.fetch).not.toHaveBeenCalled();
    view.rerender({ id: "round" });
    await waitFor(() => expect(view.result.current.data?.version).toBe(4));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/interviews/rounds/round", expect.objectContaining({ cache: "no-store" }));
    view.rerender({ id: "" });
    expect(view.result.current.data).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  } finally { view.unmount(); client.clear(); }
});

test("participating Tutor refreshes use compact state with actor-scoped station content", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const revision = "a".repeat(32);
  const stations = [{ id: "station", questions: [{ id: "question", rubric: "Current guidance" }] }];
  const envelope = (version: number, content: typeof stations | null) => ({
    ok: true, json: async () => ({ actorId: "tutor", contentRevision: revision,
      round: { id: "round", version, phase: "questions", pausedAt: null, phaseDeadline: null, serverNow: "2026-11-21T00:00:00Z" }, stations: content }),
  }) as Response;
  const reads = jest.fn().mockResolvedValueOnce(envelope(1, stations)).mockResolvedValueOnce(envelope(2, null));
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).endsWith("/commands") ? Promise.resolve(response(1)) : reads(input));
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRound("round", true), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.version).toBe(1));
    act(() => changed());
    await waitFor(() => expect(view.result.current.data?.version).toBe(2));
    expect(view.result.current.data?.stations).toEqual(stations);
    expect(view.result.current.actorId).toBe("tutor");
    expect(reads.mock.calls.map(([input]: [RequestInfo | URL]) => input)).toEqual([
      "/api/interviews/rounds/round?live=1", `/api/interviews/rounds/round?live=1&contentRevision=${revision}`,
    ]);
  } finally { view.unmount(); client.clear(); }
});

test("a fresh prompt print cannot replace the live actor identity or station-content cache", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  global.fetch = jest.fn((input: RequestInfo | URL) => String(input).includes("?live=1")
    ? Promise.resolve(response(1)) : Promise.resolve(response(2, false)));
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(({ printId }) => ({ live: useInterviewRound("round", true), print: useInterviewPrintRound(printId) }), { initialProps: { printId: "" }, wrapper });
  try {
    await waitFor(() => expect(view.result.current.live.actorId).toBe("tutor"));
    view.rerender({ printId: "round" });
    await waitFor(() => expect(view.result.current.print.data?.version).toBe(2));
    expect(view.result.current.live.actorId).toBe("tutor");
    expect(view.result.current.live.data?.version).toBe(1);
  } finally { view.unmount(); client.clear(); }
});
