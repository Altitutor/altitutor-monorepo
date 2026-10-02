"use client";
import { useEffect } from "react";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import { useAccessoryPanel } from "@/shared/contexts/AccessoryPanelContext";
export function useAccessoryTitle(title: string | null | undefined) {
  const key = useAccessoryTab()?.tab.key;
  const updateTitle = useAccessoryPanel()?.updateTitle;
  useEffect(() => {
    if (key && title) updateTitle?.(key, title);
  }, [key, title, updateTitle]);
}
