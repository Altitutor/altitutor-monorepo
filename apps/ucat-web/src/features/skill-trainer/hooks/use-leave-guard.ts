"use client";

import { useEffect, useRef } from "react";

const DEFAULT_MESSAGE =
  "Leave this skill trainer? Your timed run will keep going in the background.";

/**
 * Browser leave confirmation for in-progress skill trainer attempts.
 */
export function useLeaveGuard(active: boolean, message = DEFAULT_MESSAGE) {
  const skipRef = useRef(false);

  const allowLeave = () => {
    skipRef.current = true;
  };

  useEffect(() => {
    if (!active) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (skipRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    const handleClick = (event: MouseEvent) => {
      if (skipRef.current) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor?.href) return;
      if (anchor.hasAttribute("data-skip-leave-warning")) {
        skipRef.current = true;
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
    };
  }, [active, message]);

  return { allowLeave };
}
