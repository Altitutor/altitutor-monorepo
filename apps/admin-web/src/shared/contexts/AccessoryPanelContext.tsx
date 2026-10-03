"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuthStore } from "@/shared/lib/supabase/auth";

export type AccessoryKind =
  | "today"
  | "tasks"
  | "task"
  | "issues"
  | "issue"
  | "projects"
  | "project"
  | "documents"
  | "document"
  | "messages";
export type AccessoryOwner = { kind: AccessoryKind; id: string; title: string };
export type AccessoryDestination = {
  owner?: AccessoryOwner;
  kind: AccessoryKind;
  id?: string;
  title: string;
  query?: string;
};
export const accessoryFamily = (kind: AccessoryKind) =>
  (
    ({
      task: "tasks",
      issue: "issues",
      project: "projects",
      document: "documents",
    }) as Partial<Record<AccessoryKind, AccessoryKind>>
  )[kind] ?? kind;
export type AccessoryTab = {
  owner?: AccessoryOwner;
  key: string;
  locations?: Record<string, AccessoryDestination>;
  kind: AccessoryKind;
  id?: string;
  title: string;
  query: string;
};
type Workspace = {
  tabs: AccessoryTab[];
  activeKey: string | null;
  expanded: boolean;
  width: number;
};
const empty: Workspace = {
  tabs: [],
  activeKey: null,
  expanded: false,
  width: 520,
};
const kinds: AccessoryKind[] = [
  "today",
  "tasks",
  "task",
  "issues",
  "issue",
  "projects",
  "project",
  "documents",
  "document",
  "messages",
];
type AccessoryPanel = Workspace & {
  openTab: (
    tab: Omit<AccessoryTab, "key" | "query"> & { query?: string },
  ) => void;
  navigateTab: (key: string, destination: AccessoryDestination) => void;
  selectTab: (key: string) => void;
  closeTab: (key: string) => void;
  updateQuery: (key: string, query: string) => void;
  updateTitle: (key: string, title: string) => void;
  setWidth: (width: number) => void;
  collapse: () => void;
  toggle: () => void;
};
const Context = createContext<AccessoryPanel | null>(null);

export function AccessoryPanelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const storageKey = user?.id ? `admin-accessory-v1:${user.id}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<Workspace>(empty);
  useEffect(() => {
    let next = empty;
    if (storageKey) {
      try {
        const saved: unknown = JSON.parse(
          localStorage.getItem(storageKey) ?? "null",
        );
        if (
          saved &&
          typeof saved === "object" &&
          "tabs" in saved &&
          Array.isArray(saved.tabs)
        ) {
          const valid = saved.tabs.filter(
            (tab): tab is AccessoryTab =>
              !!tab &&
              typeof tab.key === "string" &&
              kinds.includes(tab.kind) &&
              typeof tab.title === "string" &&
              typeof tab.query === "string" &&
              (tab.id === undefined || typeof tab.id === "string"),
          );
          const data = saved as Partial<Workspace>;
          next = {
            tabs: valid,
            activeKey: valid.some((t) => t.key === data.activeKey)
              ? data.activeKey!
              : (valid[0]?.key ?? null),
            expanded: data.expanded === true,
            width:
              typeof data.width === "number" && Number.isFinite(data.width)
                ? Math.max(320, data.width)
                : 520,
          };
        }
      } catch {
        /* A blocked or corrupt browser store starts an empty workspace. */
      }
    }
    setWorkspace(next);
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(workspace));
    } catch {
      /* Session state still works when storage is unavailable. */
    }
  }, [storageKey, loadedKey, workspace]);
  const openTab = useCallback(
    (tab: Omit<AccessoryTab, "key" | "query"> & { query?: string }) => {
      setWorkspace((current) => {
        const existing = current.tabs.find(
          (t) => t.kind === tab.kind && t.id === tab.id,
        );
        if (existing)
          return { ...current, activeKey: existing.key, expanded: true };
        const next = {
          ...tab,
          query: tab.query ?? "",
          key: crypto.randomUUID(),
        };
        return {
          ...current,
          tabs: [...current.tabs, next],
          activeKey: next.key,
          expanded: true,
        };
      });
    },
    [],
  );
  const navigateTab = useCallback(
    (key: string, destination: AccessoryDestination) => {
      setWorkspace((current) => ({
        ...current,
        expanded: true,
        tabs: current.tabs.map((tab) => {
          if (tab.key !== key) return tab;
          const locationKey = (value: AccessoryDestination) =>
            `${value.kind}:${value.id ?? ""}`;
          const locations = {
            ...tab.locations,
            [locationKey(tab)]: {
              kind: tab.kind,
              id: tab.id,
              title: tab.title,
              query: tab.query,
              owner: tab.owner,
            },
          };
          const previous = locations[locationKey(destination)];
          return {
            ...tab,
            ...destination,
            id: destination.id,
            owner: destination.owner,
            query: destination.query ?? previous?.query ?? "",
            locations,
          };
        }),
      }));
    },
    [],
  );
  const selectTab = useCallback(
    (activeKey: string) =>
      setWorkspace((current) => ({ ...current, activeKey })),
    [],
  );
  const closeTab = useCallback(
    (key: string) =>
      setWorkspace((current) => {
        const index = current.tabs.findIndex((t) => t.key === key);
        const tabs = current.tabs.filter((t) => t.key !== key);
        return {
          ...current,
          tabs,
          activeKey:
            current.activeKey === key
              ? (tabs[Math.min(index, tabs.length - 1)]?.key ?? null)
              : current.activeKey,
        };
      }),
    [],
  );
  const updateQuery = useCallback(
    (key: string, query: string) =>
      setWorkspace((current) => ({
        ...current,
        tabs: current.tabs.map((t) => {
          if (t.key !== key) return t;
          if (t.query === query) return t;
          const params = new URLSearchParams(query);
          return {
            ...t,
            query,
            id:
              t.kind === "messages" && t.id
                ? (params.get("contact") ?? params.get("group") ?? t.id)
                : t.id,
          };
        }),
      })),
    [],
  );
  const updateTitle = useCallback(
    (key: string, title: string) =>
      setWorkspace((current) => {
        if (current.tabs.find((t) => t.key === key)?.title === title)
          return current;
        return {
          ...current,
          tabs: current.tabs.map((t) => (t.key === key ? { ...t, title } : t)),
        };
      }),
    [],
  );
  const setWidth = useCallback(
    (width: number) => setWorkspace((current) => ({ ...current, width })),
    [],
  );
  const collapse = useCallback(
    () => setWorkspace((current) => ({ ...current, expanded: false })),
    [],
  );
  const toggle = useCallback(
    () =>
      setWorkspace((current) => ({ ...current, expanded: !current.expanded })),
    [],
  );
  const value = useMemo(
    () => ({
      ...workspace,
      openTab,
      navigateTab,
      selectTab,
      closeTab,
      updateQuery,
      updateTitle,
      setWidth,
      collapse,
      toggle,
    }),
    [
      workspace,
      openTab,
      navigateTab,
      selectTab,
      closeTab,
      updateQuery,
      updateTitle,
      setWidth,
      collapse,
      toggle,
    ],
  );
  return (
    <Context.Provider value={value}>
      {loadedKey === storageKey ? children : null}
    </Context.Provider>
  );
}
export function useAccessoryPanel() {
  return useContext(Context);
}
