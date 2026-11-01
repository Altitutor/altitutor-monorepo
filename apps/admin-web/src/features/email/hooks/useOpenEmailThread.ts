"use client";
import { useCallback } from "react";
import {
  useAccessoryPanel,
  useAccessoryPanelActions,
} from "@/shared/contexts/AccessoryPanelContext";

/** Email uses the same workspace, persistence and expansion as SMS tabs. */
export function useOpenEmailThread() {
  const panel = useAccessoryPanelActions();
  const workspace = useAccessoryPanel();
  return useCallback(
    (
      id: string,
      subject: string,
      action?: "reply" | "forward" | "draft",
      messageId?: string,
    ) => {
      const query = action
        ? new URLSearchParams({
            action,
            token: crypto.randomUUID(),
            ...(messageId ? { message: messageId } : {}),
          }).toString()
        : undefined;
      const existing = workspace?.tabs.find(
        (tab) => tab.kind === "email" && tab.id === id,
      );
      if (existing && query) panel?.updateQuery(existing.key, query);
      panel?.openTab({
        kind: "email",
        id,
        title: subject.trim() || "Email conversation",
        ...(query ? { query } : {}),
      });
    },
    [panel, workspace?.tabs],
  );
}

export function useComposeEmail() {
  const panel = useAccessoryPanelActions();
  return useCallback(
    () =>
      panel?.openTab({
        kind: "email",
        id: `compose:${crypto.randomUUID()}`,
        title: "New email",
      }),
    [panel],
  );
}
