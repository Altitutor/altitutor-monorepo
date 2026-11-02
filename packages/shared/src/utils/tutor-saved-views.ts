import type { DataTableState } from "../types/data-table";
import type { QuickFilter, QuickFilterConfig } from "../types/quick-filters";
import {
  encodeViewConfig,
  getViewSettings,
  readViewSettings,
  type DisplaySettings,
} from "./saved-views";

const PAGE_KEY = /^[a-z0-9_]+$/;
const ENTITY = /^tutor:[a-z0-9_]+$/;
const MAX_NAME_LENGTH = 80;
const MAX_CONFIG_LENGTH = 50_000;

export function tutorViewEntity(pageKey: string): string {
  if (!PAGE_KEY.test(pageKey)) {
    throw new Error("A tutor view page key must use lowercase letters, numbers, and underscores.");
  }
  return `tutor:${pageKey}`;
}

export function isTutorViewEntity(entity: string): boolean {
  return ENTITY.test(entity);
}

export function tutorCanReadSavedView(
  row: { target_entity: string; user_id: string | null },
  actorId: string,
): boolean {
  return (
    isTutorViewEntity(row.target_entity) &&
    (row.user_id === null || row.user_id === actorId)
  );
}

export function tutorDefaultDisplaySettings(
  visibleColumns: string[],
  overrides?: Partial<DisplaySettings>,
): DisplaySettings {
  return {
    filters: {},
    sortBy: null,
    sortDirection: "desc",
    groupBy: null,
    visibleColumns,
    ...overrides,
  };
}

type ViewWrite = {
  name: string;
  target_entity: string;
  user_id: string | null;
  config: QuickFilterConfig;
};

export function assertTutorViewWrite(input: {
  actorId: string;
  existing: { target_entity: string; user_id: string | null } | null;
  next: ViewWrite;
}): { ok: true; row: ViewWrite } | { ok: false; error: string } {
  const name = input.next.name.trim();
  if (!name || name.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "Enter a view name." };
  }
  if (!isTutorViewEntity(input.next.target_entity)) {
    return { ok: false, error: "That page cannot save tutor views." };
  }
  if (input.next.user_id !== null && input.next.user_id !== input.actorId) {
    return { ok: false, error: "A view can only be personal or shared with tutors." };
  }
  if (
    input.existing &&
    !tutorCanReadSavedView(input.existing, input.actorId)
  ) {
    return { ok: false, error: "You cannot change that view." };
  }
  if (!getViewSettings(input.next.config)) {
    return { ok: false, error: "That view configuration is invalid." };
  }
  if (JSON.stringify(input.next.config).length > MAX_CONFIG_LENGTH) {
    return { ok: false, error: "That view configuration is too large." };
  }
  return {
    ok: true,
    row: {
      name,
      target_entity: input.next.target_entity,
      user_id: input.next.user_id,
      config: input.next.config,
    },
  };
}

export function withBuiltinSavedView(
  entity: string,
  views: QuickFilter[] | undefined,
  defaultView: { name: string; settings: DisplaySettings },
): QuickFilter[] {
  const builtIn: QuickFilter = {
    id: `builtin:${entity}:default`,
    name: defaultView.name,
    target_entity: entity,
    user_id: null,
    created_at: "",
    updated_at: "",
    config: encodeViewConfig(defaultView.settings),
  };
  return [builtIn, ...(views ?? [])];
}

export function applySavedViewToTableState(
  previous: DataTableState,
  view: QuickFilter,
  defaults: DisplaySettings,
  userId?: string,
): DataTableState {
  const settings = readViewSettings(view.config, defaults, userId);
  return {
    ...previous,
    filters: settings.filters,
    sortBy: settings.sortBy,
    sortDirection: settings.sortDirection,
    groupBy: settings.groupBy,
    visibleColumns: settings.visibleColumns,
    ...(settings.layout ? { view: settings.layout } : {}),
    page: 1,
  };
}
