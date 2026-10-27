"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewRound } from "@altitutor/shared";

type RoundClock = Pick<
  InterviewRound,
  "phase" | "pausedAt" | "phaseDeadline" | "serverNow"
>;
interface RoundSyncAdapter {
  refresh: () => Promise<unknown>;
  send: (type: "heartbeat" | "tick") => Promise<unknown>;
  subscribe: (
    changed: () => void,
    connected: (value: boolean) => void,
  ) => () => void;
}

/** Owns liveness, reconnect recovery and server-deadline wakeups for both portals. */
export function useInterviewRoundSync({
  scope,
  round,
  participate,
  adapter,
}: {
  scope: string | null;
  round: RoundClock | undefined;
  participate: boolean;
  adapter: RoundSyncAdapter;
}) {
  const current = useRef(adapter);
  current.current = adapter;
  const [heartbeatFailed, setHeartbeatFailed] = useState(false);
  const live = participate && !!round && round.phase !== "completed";
  const hasSnapshot = useRef(!!round);
  hasSnapshot.current = !!round;
  const afterConnected = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!scope) return;
    let disposed = false;
    let connected = false;
    let heartbeatInFlight = false;
    let fallback: ReturnType<typeof setTimeout>;
    const refresh = () => {
      if (disposed || (!live && document.hidden) || !navigator.onLine) return;
      void current.current.refresh().catch(() => undefined);
    };
    const schedule = () => {
      clearTimeout(fallback);
      fallback = setTimeout(
        () => {
          refresh();
          schedule();
        },
        live ? (connected ? 30_000 : 10_000) : 60_000,
      );
    };
    const heartbeat = async () => {
      if (!live || disposed || heartbeatInFlight) return;
      if (!navigator.onLine) {
        setHeartbeatFailed(true);
        return;
      }
      heartbeatInFlight = true;
      try {
        await current.current.send("heartbeat");
        if (!disposed) setHeartbeatFailed(false);
      } catch {
        if (!disposed) setHeartbeatFailed(true);
      } finally {
        heartbeatInFlight = false;
      }
    };
    const unsubscribe = current.current.subscribe(refresh, (value) => {
      const reconnected = value && !connected;
      connected = value;
      if (!disposed) {
        schedule();
        if (reconnected) {
          // Read after every connection, including the first. Wait for the
          // initial snapshot so query deduplication cannot swallow recovery.
          afterConnected.current = () => {
            if (!hasSnapshot.current) return;
            afterConnected.current = null;
            refresh();
          };
          afterConnected.current();
        }
      }
    });
    void heartbeat();
    const interval = live
      ? setInterval(() => {
          void heartbeat();
        }, 10_000)
      : null;
    const reconnect = () => {
      void heartbeat();
      refresh();
    };
    const visible = () => {
      if (!document.hidden) reconnect();
    };
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    document.addEventListener("visibilitychange", visible);
    schedule();
    return () => {
      disposed = true;
      afterConnected.current = null;
      clearTimeout(fallback);
      if (interval) clearInterval(interval);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
      document.removeEventListener("visibilitychange", visible);
      unsubscribe();
    };
  }, [scope, live]);
  useEffect(() => {
    if (round) afterConnected.current?.();
  }, [scope, live, !!round]);

  const ticked = useRef<string | null>(null);
  useEffect(() => {
    if (!scope || !live || !round?.phaseDeadline || round.pausedAt) return;
    const deadline = round.phaseDeadline;
    const key = `${scope}:${deadline}`;
    if (ticked.current === key) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (disposed || ticked.current === key) return;
      ticked.current = key;
      try {
        await current.current.send("tick");
        if (!disposed) await current.current.refresh();
      } catch {
        if (ticked.current === key) ticked.current = null;
        if (!disposed)
          timer = setTimeout(() => {
            void tick();
          }, 5_000);
      }
    };
    timer = setTimeout(
      () => {
        void tick();
      },
      Math.max(0, Date.parse(deadline) - Date.parse(round.serverNow)),
    );
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [scope, live, round?.phaseDeadline, round?.pausedAt, round?.serverNow]);
  return { heartbeatFailed: live && heartbeatFailed };
}
