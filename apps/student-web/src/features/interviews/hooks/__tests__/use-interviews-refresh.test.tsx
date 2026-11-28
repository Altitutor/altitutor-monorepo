import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useInterviewRound } from "../use-interviews";

const actorId = "actor";
jest.mock("@/shared/lib/supabase/auth", () => ({ useAuthStore: () => ({ user: { id: actorId }, loading: false }) }));
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
const response = (version: number) => ({ ok: true, json: async () => ({ id: "round", version, phase: "waiting", pausedAt: null, phaseDeadline: null, serverNow: "2026-11-20T00:00:00Z" }) }) as Response;

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
