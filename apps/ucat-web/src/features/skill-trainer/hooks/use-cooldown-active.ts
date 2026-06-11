"use client";

import { useEffect, useState } from "react";

/** Re-evaluates when cooldown_until elapses so the UI unlocks without a refresh. */
export function useCooldownActive(cooldownUntil: string | null | undefined): boolean {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!cooldownUntil) return;
    const remaining = new Date(cooldownUntil).getTime() - Date.now();
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setTick((n) => n + 1), remaining + 50);
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);

  void tick;

  if (!cooldownUntil) return false;
  return new Date(cooldownUntil).getTime() > Date.now();
}
