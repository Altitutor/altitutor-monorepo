"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Enables Recharts draw animation once on entrance, then disables it.
 * Prevents resize/reflow from replaying the path animation.
 */
export function useOnceChartAnimation(
  enabled = true,
  durationMs = 1300,
): boolean {
  const reduceMotion = useReducedMotion();
  const [hasPlayed, setHasPlayed] = useState(false);

  useEffect(() => {
    if (reduceMotion || !enabled || hasPlayed) return;
    const timer = window.setTimeout(() => {
      setHasPlayed(true);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, enabled, hasPlayed, reduceMotion]);

  return Boolean(!reduceMotion && enabled && !hasPlayed);
}
