"use client";

import { useEffect, useRef, useState } from "react";

// Throwaway navigation-guard demonstration. Production needs the browser matrix
// and durable feedback flush before allowing an explicit exit.
export function usePrototypeLeaveGuard() {
  const [destination, setDestination] = useState<string | "back" | null>(null);
  const allowLeave = useRef(false);

  useEffect(() => {
    // Same-URL sentinel lets Back trigger a warning before leaving this route.
    // Retain Next's history state, including its route tree.
    if (!window.history.state?.dev8InterviewGuard) {
      window.history.pushState(
        { ...window.history.state, dev8InterviewGuard: true },
        "",
        window.location.href,
      );
    }
    let restoring = false;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowLeave.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onBack = (event: PopStateEvent) => {
      if (allowLeave.current) return;
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
        allowLeave.current ||
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
  }, []);

  return {
    open: destination !== null,
    requestExit: () => setDestination("/dashboard"),
    cancelExit: () => setDestination(null),
    confirmExit: () => {
      allowLeave.current = true;
      if (destination === "back" && window.history.length > 2)
        window.history.go(-2);
      else
        window.location.assign(
          destination === "back" ? "/dashboard" : (destination ?? "/dashboard"),
        );
    },
  };
}
