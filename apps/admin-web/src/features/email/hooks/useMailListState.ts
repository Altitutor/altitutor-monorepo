"use client";

import { useEffect, useState } from "react";
import { encodeViewConfig, getViewSettings, type DisplaySettings } from "@altitutor/shared";
import { z } from "zod";
import { useAuthStore } from "@/shared/lib/supabase/auth";

export const defaultMailListSettings: DisplaySettings = {
  filters: {},
  sortBy: "received",
  sortDirection: "desc",
  groupBy: null,
  visibleColumns: ["sender", "subject", "time", "preview", "assignee"],
};

interface MailListState {
  folder?: string;
  search: string;
  offset: number;
  settings: DisplaySettings;
}

const initialState: MailListState = {
  search: "",
  offset: 0,
  settings: defaultMailListSettings,
};

const savedState = z.object({
  folder: z.string().optional(),
  search: z.string(),
  offset: z.number().int().nonnegative(),
  display: z.record(z.string(), z.array(z.unknown())),
});

export function useMailListState() {
  const userId = useAuthStore((state) => state.user?.id);
  const [list, setList] = useState(initialState);
  const [loaded, setLoaded] = useState<{ userId: string; key: string }>();
  const ready = Boolean(userId && loaded?.userId === userId);

  useEffect(() => {
    if (!userId) return;
    const pane = window.frameElement?.closest('[id^="workspace-pane-"]')?.id ?? "primary";
    const key = `admin-email-list-v1:${userId}:${pane}`;
    let next = initialState;
    try {
      const saved = savedState.safeParse(JSON.parse(sessionStorage.getItem(key) ?? "null"));
      if (saved.success) {
        const { display, ...preferences } = saved.data;
        const settings = getViewSettings(display);
        if (settings) next = { ...preferences, settings };
      }
    } catch {
      // A blocked or invalid session store starts with the inbox defaults.
    }
    setList(next);
    setLoaded({ userId, key });
  }, [userId]);

  useEffect(() => {
    if (!ready || !loaded) return;
    const { settings, ...preferences } = list;
    try {
      sessionStorage.setItem(loaded.key, JSON.stringify({
        ...preferences,
        display: encodeViewConfig(settings),
      }));
    } catch {
      // The mounted inbox retains its state when storage is unavailable.
    }
  }, [list, loaded, ready]);

  return { list, setList, ready };
}
