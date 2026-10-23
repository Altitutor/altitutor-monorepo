"use client";

import { useUcatTableState } from "@/features/ucat/shared/hooks/useUcatTableState";
import type { DataTableState } from "@altitutor/shared";

export function useInterviewTable(
  visibleColumns: string[],
  defaultFilters?: Record<string, unknown[]>,
) {
  return useUcatTableState(visibleColumns, {
    defaultFilters,
    defaultPageSize: 20,
  });
}

export function selectedFilter(
  filters: Record<string, unknown[]>,
  key: string,
): string[] {
  return (filters[key] ?? []).map(String);
}

export function matchesMulti(
  filters: Record<string, unknown[]>,
  key: string,
  value: string,
): boolean {
  const selected = selectedFilter(filters, key);
  if (!selected.length) return true;
  return selected.includes(value);
}

export function sortRows<T>(
  rows: T[],
  state: Pick<DataTableState, "sortBy" | "sortDirection">,
  fallback: string,
  getters: Record<string, (row: T) => string | number>,
): T[] {
  const key = state.sortBy && getters[state.sortBy] ? state.sortBy : fallback;
  const get = getters[key];
  if (!get) return rows;
  const sign = state.sortBy
    ? state.sortDirection === "asc"
      ? 1
      : -1
    : -1;
  return [...rows].sort((a, b) => {
    const left = get(a);
    const right = get(b);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * sign;
    }
    return String(left).localeCompare(String(right)) * sign;
  });
}

export function pageRows<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    total,
    rows: rows.slice(start, start + pageSize),
  };
}
