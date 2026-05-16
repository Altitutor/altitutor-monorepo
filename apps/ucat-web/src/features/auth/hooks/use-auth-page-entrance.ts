"use client";

import { gsap } from "gsap";
import { useEffect, useRef } from "react";

const AUTH_ENTRANCE = ".auth-entrance";

/**
 * Staggered fade-up for auth screens (same spirit as landing hero: `gsap.from`, `power3.out`).
 * Pass `rerunKey` when the tree swaps (e.g. signup OTP step) so the entrance runs again.
 */
export function useAuthPageEntrance(rerunKey?: string) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const ctx = gsap.context(() => {
      const targets = root.querySelectorAll<HTMLElement>(AUTH_ENTRANCE);
      if (targets.length === 0) return;

      gsap.from(targets, {
        y: 28,
        opacity: 0,
        duration: 0.88,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.08,
      });
    }, root);

    return () => ctx.revert();
  }, [rerunKey]);

  return containerRef;
}
