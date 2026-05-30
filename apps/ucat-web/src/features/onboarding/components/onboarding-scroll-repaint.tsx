"use client";

import { useEffect, useRef } from "react";
import { useNextStep } from "nextstepjs";

/**
 * nextstepjs only recomputes spotlight position on `resize`. Dispatch a
 * synthetic resize on window scroll so highlights stay aligned with targets
 * while the document (or nested scroll containers) moves.
 *
 * Steps that anchor to a `position: fixed` target should set
 * `viewportID: UCAT_NEXTSTEP_FIXED_VIEWPORT_ID` in `tour-steps.tsx`. That
 * mounts the overlay into the fixed portal so the spotlight position is
 * stable across scroll without any repainting at all.
 */
export function OnboardingScrollRepaint() {
  const { isNextStepVisible } = useNextStep();
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isNextStepVisible) return;

    const bump = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
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
