import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInterviewRounds } from "../use-interviews";

jest.mock("@/features/staff/hooks/useStaffQuery", () => ({ useCurrentStaff: jest.fn() }));
jest.mock("../use-interview-access", () => ({ useInterviewAccess: jest.fn() }));
let actorId = "actor";
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: actorId }, loading: false }) }));
jest.mock("@altitutor/ui", () => ({ useToast: () => ({ toast: jest.fn() }) }));
jest.mock("@/shared/lib/supabase/client", () => ({ getSupabaseClient: jest.fn() }));

test("keeps completed history available without reading it on each live list poll", async () => {
  jest.useFakeTimers();
  const active = { id: "active", version: 1, phase: "waiting" };
  const completed = { id: "done", version: 1, phase: "completed" };
  const paths: URL[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    paths.push(url);
    const collection = url.searchParams.get("collection");
    const body = collection === "current"
      ? { rounds: [active], history: [{ id: "done", version: 1 }] }
      : collection === "history"
        ? { rounds: [completed], nextCursor: null }
        : [active, completed];
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.map((round) => round.id).sort()).toEqual(["active", "done"]));
    expect(paths.filter((url) => url.searchParams.get("collection") === "current")).toHaveLength(1);
    expect(paths.filter((url) => url.searchParams.get("collection") === "history")).toHaveLength(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    await waitFor(() => expect(paths.filter((url) => url.searchParams.get("collection") === "current")).toHaveLength(2));
    expect(paths.filter((url) => url.searchParams.get("collection") === "history")).toHaveLength(1);
    expect(view.result.current.data?.map((round) => round.id).sort()).toEqual(["active", "done"]);
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});

test("a fresh history manifest removes lost visibility and refreshes edited results", async () => {
  jest.useFakeTimers();
  let updated = false;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    const body = url.searchParams.get("collection") === "current"
      ? { rounds: [], history: updated ? [{ id: "kept", version: 2 }] : [{ id: "kept", version: 1 }, { id: "removed", version: 1 }] }
      : { rounds: updated ? [{ id: "kept", version: 2, phase: "completed", releasedResultCount: 1 }] : [{ id: "kept", version: 1, phase: "completed" }, { id: "removed", version: 1, phase: "completed" }], nextCursor: null };
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data).toHaveLength(2));
    updated = true;
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    await waitFor(() => expect(view.result.current.data).toEqual([{ id: "kept", version: 2, phase: "completed", releasedResultCount: 1 }]));
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});

test("transient reads keep visible rows but confirmed access denial clears them", async () => {
  jest.useFakeTimers();
  let status = 200;
  global.fetch = jest.fn(async () => ({ ok: status === 200, status, json: async () => status === 200
    ? { rounds: [{ id: "active", version: 1, phase: "waiting" }], history: [] }
    : { error: "Unavailable" } }) as Response);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.[0]?.id).toBe("active"));
    status = 503;
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current.data?.[0]?.id).toBe("active");
    status = 403;
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current.data).toBeUndefined();
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});

test("switching actors cannot display the previous actor's history placeholder", async () => {
  let finishOther!: (response: Response) => void;
  const other = new Promise<Response>((resolve) => { finishOther = resolve; });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    if (actorId === "other" && url.searchParams.get("collection") === "history") return other;
    const body = url.searchParams.get("collection") === "current"
      ? { rounds: [], history: [{ id: actorId, version: 1 }] }
      : { rounds: [{ id: actorId, version: 1, phase: "completed" }], nextCursor: null };
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.[0]?.id).toBe("actor"));
    actorId = "other";
    view.rerender();
    await waitFor(() => expect(view.result.current.isFetching).toBe(true));
    expect(view.result.current.data).toBeUndefined();
    await act(async () => { finishOther({ ok: true, json: async () => ({ rounds: [{ id: "other", version: 1, phase: "completed" }], nextCursor: null }) } as Response); });
    await waitFor(() => expect(view.result.current.data?.[0]?.id).toBe("other"));
  } finally { actorId = "actor"; view.unmount(); client.clear(); }
});

test("a completing round stays visible while its completed history page is loading", async () => {
  jest.useFakeTimers();
  let complete = false;
  let finishHistory!: (response: Response) => void;
  const history = new Promise<Response>((resolve) => { finishHistory = resolve; });
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    if (url.searchParams.get("collection") === "history")
      return complete ? history : { ok: true, json: async () => ({ rounds: [], nextCursor: null }) } as Response;
    return { ok: true, json: async () => ({
      rounds: complete ? [] : [{ id: "active", version: 1, phase: "questions" }],
      history: complete ? [{ id: "active", version: 2 }] : [],
    }) } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.[0]?.phase).toBe("questions"));
    complete = true;
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current.data?.[0]).toMatchObject({ id: "active", phase: "completed" });
    await act(async () => { finishHistory({ ok: true, json: async () => ({ rounds: [{ id: "active", version: 2, phase: "completed", releasedResultCount: 1 }], nextCursor: null }) } as Response); });
    await waitFor(() => expect(view.result.current.data?.[0]?.version).toBe(2));
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});

test("manual refresh fetches only the new history revision once", async () => {
  let version = 1;
  let historyReads = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    const current = url.searchParams.get("collection") === "current";
    if (!current) historyReads++;
    const body = current ? { rounds: [], history: [{ id: "done", version }] }
      : { rounds: [{ id: "done", version, phase: "completed" }], nextCursor: null };
    return { ok: true, json: async () => body } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.[0]?.version).toBe(1));
    version = 2;
    await act(async () => { await view.result.current.refetch(); });
    await waitFor(() => expect(view.result.current.data?.[0]?.version).toBe(2));
    expect(historyReads).toBe(2);
  } finally { view.unmount(); client.clear(); }
});

test("a transient revised-history failure retains the last safe visible summary", async () => {
  jest.useFakeTimers();
  let version = 1;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    if (url.searchParams.get("collection") === "current")
      return { ok: true, json: async () => ({ rounds: [], history: [{ id: "done", version }] }) } as Response;
    return { ok: version === 1, status: version === 1 ? 200 : 503, json: async () => version === 1
      ? { rounds: [{ id: "done", version: 1, phase: "completed" }], nextCursor: null }
      : { error: "History temporarily unavailable" } } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(view.result.current.data?.[0]?.id).toBe("done"));
    version = 2;
    await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current.error).toBeDefined();
    expect(view.result.current.data?.[0]?.id).toBe("done");
  } finally { view.unmount(); client.clear(); jest.useRealTimers(); }
});

test("initial global results wait for every bounded history page", async () => {
  let finishPage!: (response: Response) => void;
  const secondPage = new Promise<Response>((resolve) => { finishPage = resolve; });
  const cursors: Array<string | null> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "https://portal.test");
    if (url.searchParams.get("collection") === "current")
      return { ok: true, json: async () => ({ rounds: [], history: [{ id: "first", version: 1 }, { id: "second", version: 1 }] }) } as Response;
    cursors.push(url.searchParams.get("cursor"));
    if (cursors.length === 2) return secondPage;
    return { ok: true, json: async () => ({ rounds: [{ id: "first", version: 1, phase: "completed" }], nextCursor: "first" }) } as Response;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const view = renderHook(() => useInterviewRounds(), { wrapper });
  try {
    await waitFor(() => expect(cursors).toEqual([null, "first"]));
    expect(view.result.current.data).toBeUndefined();
    expect(view.result.current.isPending).toBe(true);
    await act(async () => { finishPage({ ok: true, json: async () => ({ rounds: [{ id: "second", version: 1, phase: "completed" }], nextCursor: null }) } as Response); });
    await waitFor(() => expect(view.result.current.data?.map((round) => round.id)).toEqual(["first", "second"]));
  } finally { view.unmount(); client.clear(); }
});
