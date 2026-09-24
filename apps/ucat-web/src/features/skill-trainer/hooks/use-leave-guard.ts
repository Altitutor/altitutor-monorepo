"use client";

import { useCallback, useEffect, useRef } from "react";
import { skillTrainerApi } from "@/features/skill-trainer/api/skill-trainer-api";

export const SKILL_TRAINER_LEAVE_MESSAGE =
  "Leave this skill trainer? Your current run will be discarded.";

/**
 * Skill trainer runs only live for the current play page. Confirm intentional
 * navigation, then discard the run before leaving. A deferred cleanup covers
 * router back/replace while avoiding React Strict Mode's setup probe.
 */
export function useLeaveGuard(active: boolean, attemptId?: string) {
  const activeRef = useRef(active);
  const discardPromiseRef = useRef<Promise<void> | null>(null);
  const cleanupTimerRef = useRef<number | null>(null);
  activeRef.current = active;

  const discard = useCallback(
    (keepalive = false) => {
      if (!attemptId) return Promise.resolve();
      if (discardPromiseRef.current) return discardPromiseRef.current;

      const request = skillTrainerApi
        .discardAttempt(attemptId, { keepalive })
        .catch((error) => {
          discardPromiseRef.current = null;
          throw error;
        });
      discardPromiseRef.current = request;
      return request;
    },
    [attemptId],
  );

  const confirmDiscard = useCallback(async () => {
    if (!active || !window.confirm(SKILL_TRAINER_LEAVE_MESSAGE)) return false;
    await discard();
    return true;
  }, [active, discard]);

  useEffect(() => {
    if (cleanupTimerRef.current != null) {
      window.clearTimeout(cleanupTimerRef.current);
      cleanupTimerRef.current = null;
    }
    if (!active || !attemptId) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handlePageHide = () => {
      void discard(true).catch(() => undefined);
    };
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor?.href) return;

      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm(SKILL_TRAINER_LEAVE_MESSAGE)) return;

      const navigate = () => window.location.assign(nextUrl.href);
      void discard().then(navigate, navigate);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("click", handleClick, true);
      cleanupTimerRef.current = window.setTimeout(() => {
        cleanupTimerRef.current = null;
        if (activeRef.current) {
          void discard(true).catch(() => undefined);
        }
      }, 0);
    };
  }, [active, attemptId, discard]);

  return { confirmDiscard };
}
