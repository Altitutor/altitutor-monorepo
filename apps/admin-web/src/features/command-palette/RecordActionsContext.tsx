"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import type { RecordMenuAction } from "@/shared/components/recordMenuActions";
import {
  paletteEntities,
  type EntityTarget,
  type PaletteCommand,
} from "./model";

type Source = {
  target: EntityTarget;
  active: boolean;
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
          ? source.actions.map((action) => ({
              ...action,
              id: `${source.target.type}-${source.target.id}-${action.id}`,
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
  const pathname = usePathname();
  const accessory = useAccessoryTab();
  const entityType = type === "document" ? "note" : type;
  const supported = entityType in paletteEntities;
  const active =
    !!id &&
    (accessory
      ? accessory.active &&
        accessory.tab.kind === type &&
        accessory.tab.id === id
      : !!routeNames[type] &&
        !!pathname?.endsWith(`/${routeNames[type]}/${id}`));
  const latest = useRef<Source>({
    target: { type: "student", id: "", title: "" },
    active: false,
    actions: [],
  });
  latest.current = {
    target: {
      type: supported ? (entityType as EntityTarget["type"]) : "student",
      id: id ?? "",
      title: title?.trim() || id?.slice(0, 8) || "",
    },
    active: active && supported,
    actions,
  };
  useEffect(() => {
    if (!registry || !supported || !id) return;
    return registry.register(`${type}:${id}`, () => latest.current);
  }, [registry, supported, type, id]);
}
