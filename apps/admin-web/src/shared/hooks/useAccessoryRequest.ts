"use client";
import { useEffect, useRef } from "react";
import {
  useAccessoryPanelActions,
  type AccessoryKind,
} from "@/shared/contexts/AccessoryPanelContext";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
export function useAccessoryRequest(
  isOpen: boolean,
  kind: AccessoryKind,
  id: string | null,
  onClose: () => void,
) {
  const panel = useAccessoryPanelActions();
  const scope = useAccessoryTab();
  const openTab = scope?.navigate ?? panel?.openTab;
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!isOpen || !id || !openTab) return;
    openTab({
      kind,
      id,
      title:
        kind === "document"
          ? "Document"
          : kind.charAt(0).toUpperCase() + kind.slice(1),
    });
    close.current();
  }, [isOpen, id, kind, openTab]);
}
