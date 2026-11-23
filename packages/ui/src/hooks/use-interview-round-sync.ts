"use client";

import { useEffect, useRef, useState } from "react";
import type { InterviewRound } from "@altitutor/shared";

type RoundClock = Pick<
  InterviewRound,
  "phase" | "pausedAt" | "phaseDeadline" | "serverNow"
>;
// Focus, visibility and online notifications can arrive together on one wake.
const FOREGROUND_RECOVERY_WINDOW_MS = 250;

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
  const setLive = useRef<((active: boolean) => void) | null>(null);
  useEffect(() => {
    if (!scope) return;
    let disposed = false;
    let connected = false;
    let participating = false;
    let heartbeatInFlight = false;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    let lastRecoveryAt = -Infinity;
    const refresh = () => {
      if (disposed) return false;
      // Fallback bounds the time between read attempts. A Realtime refresh
      // just before the timer fires already covers that recovery check.
      schedule();
      if ((!participating && document.hidden) || !navigator.onLine) return false;
      void current.current.refresh().catch(() => undefined);
      return true;
    };
    const schedule = () => {
      clearTimeout(fallback);
      fallback = setTimeout(
        refresh,
        participating ? (connected ? 30_000 : 10_000) : 60_000,
      );
    };
    const heartbeat = async () => {
      if (!participating || disposed || heartbeatInFlight) return;
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
    const recover = () => {
      if (refresh()) lastRecoveryAt = performance.now();
    };
    const unsubscribe = current.current.subscribe(refresh, (value) => {
      if (disposed || connected === value) return;
      connected = value;
      schedule();
      afterConnected.current = null;
      if (connected) {
        // The initial read may predate subscription. Take one recovery
        // snapshot after it settles without replacing the actor's channel.
        afterConnected.current = () => {
          if (!hasSnapshot.current) return;
          afterConnected.current = null;
          recover();
        };
        afterConnected.current();
      }
    });
    setLive.current = (active) => {
      if (participating === active) return;
      participating = active;
      clearInterval(heartbeatTimer);
      if (active) {
        void heartbeat();
        heartbeatTimer = setInterval(() => void heartbeat(), 10_000);
      }
      schedule();
    };
    const reconnect = () => {
      if (performance.now() - lastRecoveryAt < FOREGROUND_RECOVERY_WINDOW_MS)
        return;
      void heartbeat();
      recover();
    };
    const offline = () => {
      lastRecoveryAt = -Infinity;
    };
    const visible = () => {
      if (!document.hidden) reconnect();
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", reconnect);
    window.addEventListener("focus", reconnect);
    document.addEventListener("visibilitychange", visible);
    schedule();
    return () => {
      disposed = true;
      setLive.current = null;
      afterConnected.current = null;
      clearTimeout(fallback);
      clearInterval(heartbeatTimer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", reconnect);
      window.removeEventListener("focus", reconnect);
      document.removeEventListener("visibilitychange", visible);
      unsubscribe();
    };
  }, [scope]);
  useEffect(() => {
    setLive.current?.(live);
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
