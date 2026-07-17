"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";

/** Cap how often we ask nextstepjs to remeasure during continuous scroll. */
const REPAINT_MIN_INTERVAL_MS = 100;

/**
 * nextstepjs only recomputes spotlight position on `resize`. Dispatch a
 * synthetic resize on window scroll so highlights stay aligned with targets
 * while the document (or nested scroll containers) moves.
 *
 * Throttled: each resize triggers nextstep setState (and a full re-render of
 * the app tree under `<NextStep>`), so firing on every scroll frame jitters
 * the page — especially with tall spotlight targets.
 *
 * Steps that anchor to a `position: fixed` target should set
 * `viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID` in `tour-steps.tsx`. That
 * mounts the overlay into the fixed portal so the spotlight position is
 * stable across scroll without any repainting at all.
 */
export function OnboardingScrollRepaint() {
  const { isNextStepVisible } = useNextStep();
  const rafRef = useRef<number | null>(null);
  const lastRepaintAtRef = useRef(0);

  useEffect(() => {
    if (!isNextStepVisible) return;

    const bump = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const now = performance.now();
        if (now - lastRepaintAtRef.current < REPAINT_MIN_INTERVAL_MS) {
          return;
        }
        lastRepaintAtRef.current = now;
        window.dispatchEvent(new Event("resize"));
      });
    };

    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", bump, true);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isNextStepVisible]);

  return null;
}
