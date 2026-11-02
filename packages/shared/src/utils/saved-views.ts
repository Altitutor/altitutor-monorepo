import type { QuickFilter, QuickFilterConfig } from "../types/quick-filters";
import { resolveQuickFilterPlaceholders } from "./quick-filters";

export type SavedView = QuickFilter;
export interface DisplaySettings {
  layout?: string;
  filters: Record<string, unknown[]>;
  sortBy: string | null;
  sortDirection: "asc" | "desc";
  groupBy: string | null;
  visibleColumns: string[];
  columnGroups?: Record<string, string[]>;
  conditions?: Array<{
    fieldKey: string;
    operator: "contains" | "equals" | "not_contains" | "any" | "all" | "none";
    values: string[];
  }>;
}
const DISPLAY_KEY = "$display";

export function encodeViewConfig(settings: DisplaySettings): QuickFilterConfig {
  return { [DISPLAY_KEY]: [{ version: 1, ...settings }] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function getViewSettings(
  config: QuickFilterConfig,
): DisplaySettings | null {
  const value = config[DISPLAY_KEY]?.[0];
  if (!isRecord(value)) return null;
  if (
    value.version !== 1 ||
    !isRecord(value.filters) ||
    !Object.values(value.filters).every(Array.isArray) ||
    !isStringArray(value.visibleColumns) ||
    (value.sortDirection !== "asc" && value.sortDirection !== "desc") ||
    !(value.sortBy === null || typeof value.sortBy === "string") ||
    !(value.groupBy === null || typeof value.groupBy === "string")
  )
    return null;
  if (value.layout !== undefined && typeof value.layout !== "string")
    return null;
  if (
    value.columnGroups !== undefined &&
    (!isRecord(value.columnGroups) ||
      !Object.values(value.columnGroups).every(isStringArray))
  )
    return null;
  if (
    value.conditions !== undefined &&
    (!Array.isArray(value.conditions) ||
      !value.conditions.every(
        (condition: unknown) =>
          isRecord(condition) &&
          typeof condition.fieldKey === "string" &&
          ["contains", "equals", "not_contains", "any", "all", "none"].includes(
            String(condition.operator),
          ) &&
          isStringArray(condition.values),
      ))
  )
    return null;
  return {
    filters: value.filters as Record<string, unknown[]>,
    sortBy: value.sortBy,
    sortDirection: value.sortDirection,
    groupBy: value.groupBy,
    visibleColumns: value.visibleColumns,
    ...(typeof value.layout === "string" ? { layout: value.layout } : {}),
    ...(value.columnGroups
      ? { columnGroups: value.columnGroups as Record<string, string[]> }
      : {}),
    ...(value.conditions
      ? { conditions: value.conditions as DisplaySettings["conditions"] }
      : {}),
  };
}

export function readViewSettings(
  config: QuickFilterConfig,
  defaults: DisplaySettings,
  userId?: string,
): DisplaySettings {
  const settings = getViewSettings(config);
  if (settings)
    return {
      ...settings,
      filters: resolveQuickFilterPlaceholders(settings.filters, userId),
    };
  const legacy = Object.fromEntries(
    Object.entries(config).filter(([key]) => key !== DISPLAY_KEY),
  );
  const filters = resolveQuickFilterPlaceholders(legacy, userId);
  for (const alias of ["assigned_to", "assignedTo"]) {
    if (filters[alias] && !filters.assignee) filters.assignee = filters[alias];
    delete filters[alias];
  }
  for (const key of ["scheduled_at", "date", "created_at", "start_time"]) {
    const raw = legacy[key]?.[0];
    if (!raw) continue;
    const value = String(raw);
    const from = resolveQuickFilterPlaceholders({ from: [value] }, userId)
      .from[0];
    const to = resolveQuickFilterPlaceholders({ to: [value] }, userId).to[0];
    if (
      value === "$THIS_WEEK$" ||
      value === "$TODAY$" ||
      value === "$YESTERDAY$" ||
      value === "$TOMORROW$" ||
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      filters.from = [from];
      filters.to = [to];
    } else if (value === "$FUTURE$") filters.from = [from];
    else if (value === "$PAST$") filters.to = [to];
    delete filters[key];
  }
  return { ...defaults, filters };
}

function stableValue(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map(stableValue).sort().join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(
          ([, item]) =>
            item !== undefined && !(Array.isArray(item) && item.length === 0),
        )
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + stableValue(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "";
}

export function displaySettingsMatch(
  left: DisplaySettings,
  right: DisplaySettings,
): boolean {
  return stableValue(left) === stableValue(right);
}
