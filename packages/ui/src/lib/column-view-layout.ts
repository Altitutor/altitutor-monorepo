import type { DataTableColumnDefinition } from '@altitutor/shared';

export function getDefaultVisibleColumnsFromDefinitions(
  columnDefinitions: DataTableColumnDefinition[],
): string[] {
  return columnDefinitions.filter((column) => column.visibleByDefault !== false).map((column) => column.key);
}

export function canResolveDefaultVisibleColumns(
  columnDefinitions: DataTableColumnDefinition[],
  defaultVisibleColumns?: string[],
): boolean {
  if (defaultVisibleColumns != null) {
    return true;
  }
  return columnDefinitions.length > 0;
}

export function resolveDefaultVisibleColumns(
  columnDefinitions: DataTableColumnDefinition[],
  defaultVisibleColumns?: string[],
): string[] {
  if (defaultVisibleColumns != null) {
    return defaultVisibleColumns;
  }
  return getDefaultVisibleColumnsFromDefinitions(columnDefinitions);
}

export function ensureAtLeastOneVisibleColumn(columns: string[], availableKeys: string[]): string[] {
  if (columns.length > 0) {
    return columns;
  }
  if (availableKeys.length === 0) {
    return columns;
  }
  return [availableKeys[0]!];
}

export function countVisibleColumnLayoutDiff(current: string[], defaults: string[]): number {
  const currentSet = new Set(current);
  const defaultSet = new Set(defaults);
  const allKeys = new Set([...current, ...defaults]);
  let diff = 0;
  for (const key of allKeys) {
    if (currentSet.has(key) !== defaultSet.has(key)) {
      diff += 1;
    }
  }
  return diff;
}

export interface ColumnViewLayoutGroup {
  columnDefinitions: DataTableColumnDefinition[];
  visibleColumns: string[];
  defaultVisibleColumns?: string[];
}

export function countColumnViewLayoutDiff(
  groups: ColumnViewLayoutGroup[],
): number {
  return groups.reduce((total, group) => {
    if (!canResolveDefaultVisibleColumns(group.columnDefinitions, group.defaultVisibleColumns)) {
      return total;
    }
    const defaults = resolveDefaultVisibleColumns(group.columnDefinitions, group.defaultVisibleColumns);
    return total + countVisibleColumnLayoutDiff(group.visibleColumns, defaults);
  }, 0);
}
