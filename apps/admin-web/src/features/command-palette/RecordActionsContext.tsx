"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { openEntityReference } from "@/shared/utils/entityReference";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";
import {
  recordEntities,
  type RecordTarget,
  type PaletteCommand,
} from "./model";

type RegisteredAction = Omit<RecordMenuAction, "action"> &
  Pick<PaletteCommand, "action" | "submenu" | "keywords"> & { ready?: () => boolean };

type Source = {
  target?: RecordTarget;
  key: string;
  active: boolean;
  primary?: boolean;
  runOnly?: boolean;
  actions: RegisteredAction[];
};
type Registry = {
  register: (key: string, get: () => Source) => () => void;
  commands: () => PaletteCommand[];
  run: (
    type: string,
    id: string,
    actionId: string,
    navigate?: () => void,
  ) => void;
  flush: () => void;
};
const Context = createContext<Registry | null>(null);

export function RecordActionsProvider({ children }: { children: ReactNode }) {
  const sources = useRef(new Map<string, () => Source>());
  const pending = useRef<{ type: string; id: string; actionId: string } | null>(
    null,
  );
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retry = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearWait = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    if (retry.current) clearInterval(retry.current);
  }, []);
  const flush = useCallback(() => {
    const request = pending.current;
    if (!request) return false;
    for (const get of sources.current.values()) {
      const source = get();
      if (
        !source.active ||
        source.target?.type !== request.type ||
        source.target.id !== request.id
      )
        continue;
      const action = source.actions.find(
        (item) => item.id === request.actionId,
      );
      if (!action?.action) continue;
      if (action.ready && !action.ready()) return true;
      pending.current = null;
      clearWait();
      if (action.disabled) toast.error("This action is currently unavailable.");
      else action.action();
      return true;
    }
    return false;
  }, [clearWait]);
  const run = useCallback(
    (type: string, id: string, actionId: string, navigate?: () => void) => {
      clearWait();
      pending.current = { type, id, actionId };
      const found = flush();
      if (!pending.current) return;
      timeout.current = setTimeout(() => {
        pending.current = null;
        clearWait();
        toast.error(
          "The record action is unavailable. Please try its record menu.",
        );
      }, 15_000);
      retry.current = setInterval(flush, 50);
      if (!found) {
        if (navigate) navigate();
        else openEntityReference(type, id);
      }
    },
    [flush, clearWait],
  );
  useEffect(
    () => () => {
      clearWait();
    },
    [clearWait],
  );
  const register = useCallback((key: string, get: () => Source) => {
    sources.current.set(key, get);
    return () => {
      if (sources.current.get(key) === get) sources.current.delete(key);
    };
  }, []);
  const commands = useCallback(
    () =>
      [...sources.current.values()].flatMap((get) => {
        const source = get();
        return source.active && !source.runOnly
          ? source.actions
              .filter((action) => !action.primaryOnly || source.primary)
              .map((action) => ({
                ...action,
                id: `${source.target ? `${source.target.type}-${source.target.id}` : source.key}-${action.id}`,
                target: source.target,
                parents: action.group ? [action.group] : [],
              }))
          : [];
      }),
    [],
  );
  const value = useMemo(
    () => ({ register, commands, run, flush }),
    [register, commands, run, flush],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Hover actions reuse the destination's guarded handlers rather than duplicating mutations. */
export function useRunRecordAction() {
  return useContext(Context)?.run;
}

export function useRecordCommands() {
  return useContext(Context)?.commands() ?? [];
}

const routeNames: Record<string, string> = {
  invoice: "invoices",
  adminShift: "admin-shifts",
  tutorLog: "tutor-logs",
  email: "email",
  student: "students",
  parent: "parents",
  staff: "staff",
  class: "classes",
  session: "sessions",
  subject: "subjects",
  topic: "topics",
  task: "tasks",
  issue: "issues",
  project: "projects",
  document: "documents",
};

export function useRegisterRecordActions(
  type: string,
  id: string | undefined,
  title: string | undefined,
  actions: RegisteredAction[],
  options?: { active?: boolean; runOnly?: boolean },
) {
  const registry = useContext(Context);
  const instance = useId();
  const pathname = usePathname();
  const accessory = useAccessoryTab();
  const entityType = type === "document" ? "note" : type;
  const supported = entityType in recordEntities;
  const active = options?.active !== undefined
    ? options.active && (!accessory || accessory.active)
    : !!id &&
      (accessory
        ? accessory.active &&
          accessory.tab.kind === type &&
          accessory.tab.id === id
        : !!routeNames[type] &&
          !!pathname?.endsWith(`/${routeNames[type]}/${id}`) &&
          !(type === "topic" && pathname === `/topics/${id}`));
  const latest = useRef<Source>({
    key: `${type}:${id}`,
    target: { type: "student", id: "", title: "" },
    active: false,
    actions: [],
  });
  latest.current = {
    key: `${type}:${id}`,
    target: {
      type: supported ? (entityType as RecordTarget["type"]) : "student",
      id: id ?? "",
      title: title?.trim() || id?.slice(0, 8) || "",
    },
    active: active && supported,
    primary: !accessory,
    actions,
    runOnly: options?.runOnly,
  };
  useEffect(() => {
    if (!registry || !supported || !id) return;
    return registry.register(`${type}:${id}:${instance}`, () => latest.current);
  }, [registry, supported, type, id, instance]);
  useEffect(() => {
    registry?.flush();
  });
}

/** Page actions share the global registry without pretending to be a record. */
export function useRegisterPageActions(
  path: string,
  actions: RegisteredAction[],
) {
  const registry = useContext(Context);
  const pathname = usePathname();
  const scope = useAccessoryTab();
  const instance = useId();
  const key = `page:${path}:${instance}`;
  const latest = useRef<Source>({ key, active: false, actions: [] });
  latest.current = {
    key,
    actions,
    active: scope
      ? scope.active && !scope.tab.id && scope.tab.kind === path.slice(1)
      : pathname === path,
  };
  useEffect(
    () => registry?.register(key, () => latest.current),
    [registry, key],
  );
}
