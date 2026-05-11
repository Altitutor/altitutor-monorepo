"use client";

import { useEffect } from "react";
import { useNextStep } from "nextstepjs";

/**
 * nextstepjs only recomputes spotlight position on `resize`. Dispatch a
 * synthetic resize on window scroll so highlights stay aligned with targets
 * while the document (or nested scroll containers) moves.
 */
export function OnboardingScrollRepaint() {
  const { isNextStepVisible } = useNextStep();

  useEffect(() => {
    if (!isNextStepVisible) return;

    const bump = () => {
      window.dispatchEvent(new Event("resize"));
    };

    window.addEventListener("scroll", bump, { passive: true, capture: true });
    return () => {
      window.removeEventListener("scroll", bump, true);
    };
  }, [isNextStepVisible]);

  return null;
}
