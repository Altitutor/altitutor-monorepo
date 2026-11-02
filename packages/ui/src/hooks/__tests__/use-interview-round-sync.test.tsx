/** @jest-environment jsdom */
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { useInterviewRoundSync } from "../use-interview-round-sync";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
const round = {
  phase: "waiting" as const,
  pausedAt: null,
  phaseDeadline: null,
  serverNow: "2026-10-25T00:00:00Z",
};

test("active participation uses slow fallback reads and heartbeats without periodic ticks; completed views stop writes", async () => {
  jest.useFakeTimers();
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
  const send = jest.fn().mockResolvedValue({});
  const refresh = jest.fn().mockResolvedValue(undefined);
  const disconnect = jest.fn();
  const subscribe = jest.fn(
    (_changed: () => void, status: (connected: boolean) => void) => {
      status(true);
      return disconnect;
    },
  );
  const root = createRoot(document.createElement("div"));
  function View({ complete = false }: { complete?: boolean }) {
    useInterviewRoundSync({
      scope: "actor:round",
      round: complete ? { ...round, phase: "completed" } : round,
      participate: true,
      adapter: { send, refresh, subscribe },
    });
    return null;
  }
  try {
    await act(async () => {
      root.render(<View />);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(send.mock.calls.map(([type]) => type)).toEqual([
      "heartbeat",
      "heartbeat",
      "heartbeat",
      "heartbeat",
    ]);
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => {
      root.render(<View complete />);
    });
    send.mockClear();
    refresh.mockClear();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(send).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => {
      root.unmount();
    });
    jest.useRealTimers();
  }
});

test("phase changes cancel stale deadline wakeups and resume ticks once at the new server deadline", async () => {
  jest.useFakeTimers();
  const send = jest.fn().mockResolvedValue({});
  const refresh = jest.fn().mockResolvedValue(undefined);
  const subscribe = (
    _changed: () => void,
    status: (connected: boolean) => void,
  ) => {
    status(true);
    return () => undefined;
  };
  const root = createRoot(document.createElement("div"));
  function View({
    paused = false,
    deadline = "2026-10-25T00:00:01Z",
  }: {
    paused?: boolean;
    deadline?: string;
  }) {
    useInterviewRoundSync({
      scope: "actor:round",
      participate: true,
      round: {
        ...round,
        phase: "reading",
        phaseDeadline: deadline,
        pausedAt: paused ? round.serverNow : null,
      },
      adapter: { send, refresh, subscribe },
    });
    return null;
  }
  try {
    await act(async () => {
      root.render(<View />);
    });
    await act(async () => {
      root.render(<View paused />);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1_001);
    });
    expect(send.mock.calls.filter(([type]) => type === "tick")).toHaveLength(0);
    await act(async () => {
      root.render(<View deadline="2026-10-25T00:00:02Z" />);
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2_001);
    });
    expect(send.mock.calls.filter(([type]) => type === "tick")).toHaveLength(1);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(refresh).toHaveBeenCalledTimes(3);
  } finally {
    await act(async () => {
      root.unmount();
    });
    jest.useRealTimers();
  }
});

test("reads again after subscribing, including when the initial snapshot is still pending", async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  const send = jest.fn().mockResolvedValue({});
  const subscribe = (
    _changed: () => void,
    status: (value: boolean) => void,
  ) => {
    status(true);
    return () => undefined;
  };
  const root = createRoot(document.createElement("div"));
  function View({ loaded = false }: { loaded?: boolean }) {
    useInterviewRoundSync({
      scope: "actor:round",
      round: loaded ? round : undefined,
      participate: false,
      adapter: { refresh, send, subscribe },
    });
    return null;
  }
  try {
    await act(async () => root.render(<View />));
    expect(refresh).not.toHaveBeenCalled();
    // A reading-start broadcast was missed before SUBSCRIBED. The old waiting
    // snapshot must finish before the recovery read can replace it.
    await act(async () => root.render(<View loaded />));
    expect(refresh).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
  }
});
