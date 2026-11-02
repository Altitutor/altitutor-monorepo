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
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";
import {
  recordEntities,
  type RecordTarget,
  type PaletteCommand,
} from "./model";

type Source = {
  target?: RecordTarget;
  key: string;
  active: boolean;
  primary?: boolean;
  actions: RecordMenuAction[];
};
type Registry = {
  register: (key: string, get: () => Source) => () => void;
  commands: () => PaletteCommand[];
};
const Context = createContext<Registry | null>(null);

export function RecordActionsProvider({ children }: { children: ReactNode }) {
  const sources = useRef(new Map<string, () => Source>());
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
        return source.active
          ? source.actions.filter((action) => !action.primaryOnly || source.primary)
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
  const value = useMemo(() => ({ register, commands }), [register, commands]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
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
  actions: RecordMenuAction[],
) {
  const registry = useContext(Context);
  const instance = useId();
  const pathname = usePathname();
  const accessory = useAccessoryTab();
  const entityType = type === "document" ? "note" : type;
  const supported = entityType in recordEntities;
  const active =
    !!id &&
    (accessory
      ? accessory.active &&
        accessory.tab.kind === type &&
        accessory.tab.id === id
      : !!routeNames[type] &&
        !!pathname?.endsWith(`/${routeNames[type]}/${id}`));
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
  };
  useEffect(() => {
    if (!registry || !supported || !id) return;
    return registry.register(`${type}:${id}:${instance}`, () => latest.current);
  }, [registry, supported, type, id, instance]);
}

/** Page actions share the global registry without pretending to be a record. */
export function useRegisterPageActions(
  path: string,
  actions: RecordMenuAction[],
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
