"use client";

import { useEffect, useRef, useState } from "react";

/** Intercepts portal links and Back; refresh/close use the browser's own warning. */
export function useInterviewLeaveGuard(enabled: boolean) {
  const [destination, setDestination] = useState<string | "back" | null>(null);
  const allowed = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    allowed.current = false;
    if (!window.history.state?.studentInterviewGuard) {
      window.history.pushState(
        { ...window.history.state, studentInterviewGuard: true },
        "",
        window.location.href,
      );
    }
    let restoring = false;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onBack = (event: PopStateEvent) => {
      if (allowed.current) return;
      event.stopImmediatePropagation();
      if (restoring) {
        restoring = false;
        return;
      }
      restoring = true;
      window.history.go(1);
      setDestination("back");
    };
    const onLink = (event: MouseEvent) => {
      if (
        allowed.current ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        !anchor ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      )
        return;
      const url = new URL(anchor.href, window.location.href);
      if (url.href === window.location.href) return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(url.href);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", onBack, true);
    document.addEventListener("click", onLink, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", onBack, true);
      document.removeEventListener("click", onLink, true);
    };
  }, [enabled]);

  return {
    open: destination !== null,
    requestExit: () => setDestination("/interviews"),
    cancelExit: () => setDestination(null),
    confirmExit: () => {
      allowed.current = true;
      if (destination === "back" && window.history.length > 2)
        window.history.go(-2);
      else
        window.location.assign(
          destination === "back"
            ? "/interviews"
            : (destination ?? "/interviews"),
        );
    },
  };
}
