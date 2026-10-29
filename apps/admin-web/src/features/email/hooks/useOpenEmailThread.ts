"use client";
import { useCallback } from "react";
import { useAccessoryPanelActions } from "@/shared/contexts/AccessoryPanelContext";

/** Email uses the same workspace, persistence and expansion as SMS tabs. */
export function useOpenEmailThread() {
  const panel = useAccessoryPanelActions();
  return useCallback(
    (id: string, subject: string) => {
      panel?.openTab({
        kind: "email",
        id,
        title: subject.trim() || "Email conversation",
      });
    },
    [panel],
  );
}
