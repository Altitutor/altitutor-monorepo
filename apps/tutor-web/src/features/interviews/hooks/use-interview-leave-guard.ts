"use client";

import { useEffect, useRef, useState } from "react";

export function useInterviewLeaveGuard() {
  const [destination, setDestination] = useState<string | null>(null);
  const allowed = useRef(false);
  useEffect(() => {
    if (!window.history.state?.interviewGuard)
      window.history.pushState(
        { ...window.history.state, interviewGuard: true },
        "",
        window.location.href,
      );
    let restoring = false;
    const unload = (event: BeforeUnloadEvent) => {
      if (!allowed.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const back = (event: PopStateEvent) => {
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
    const link = (event: MouseEvent) => {
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
        anchor.hasAttribute("download") ||
        anchor.href === window.location.href
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(anchor.href);
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("popstate", back, true);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("popstate", back, true);
      document.removeEventListener("click", link, true);
    };
  }, []);
  return {
    open: destination !== null,
    requestExit: () => setDestination("/interviews"),
    cancel: () => setDestination(null),
    leave: () => {
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
