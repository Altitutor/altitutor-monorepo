import { useMemo } from 'react';
import type { CommandPalettePage } from '../config/commandPalette.config';
import type { TutorCommandPaletteEntityResult } from '../types';
import {
  filterAndSortPages,
  filterItemsByType,
  groupItemsByType,
  type CommandPaletteItem,
  type FilterType,
} from '../utils/filtering';

export type { CommandPaletteItem };

interface UseCommandPaletteFilteringOptions {
  pages: CommandPalettePage[];
  entityResults: TutorCommandPaletteEntityResult[];
  searchQuery: string;
  selectedFilters: FilterType[];
  allFilterTypes: FilterType[];
  entityTypeMapping: Record<string, string>;
  entityTypes: Record<string, { label: string }>;
}

export function useCommandPaletteFiltering({
  pages,
  entityResults,
  searchQuery,
  selectedFilters,
  allFilterTypes,
  entityTypeMapping,
  entityTypes,
}: UseCommandPaletteFilteringOptions) {
  const filteredPages = useMemo(
    () => filterAndSortPages(pages, searchQuery),
    [pages, searchQuery],
  );

  const allItems: CommandPaletteItem[] = useMemo(() => {
    const items: CommandPaletteItem[] = [];

    filteredPages.forEach((page) => {
      items.push({ type: 'page', ...page });
    });

    entityResults.forEach((result) => {
      items.push({ type: 'entity', result });
    });

    return items;
  }, [filteredPages, entityResults]);

  const filteredItems = useMemo(
    () => filterItemsByType(allItems, selectedFilters, allFilterTypes),
    [allItems, selectedFilters, allFilterTypes],
  );

  const groupedItems = useMemo(
    () => groupItemsByType(filteredItems, searchQuery, entityTypeMapping, entityTypes),
    [filteredItems, searchQuery, entityTypeMapping, entityTypes],
  );

  const displayItems = useMemo(
    () => groupedItems.flatMap((group) => group.items),
    [groupedItems],
  );

  return {
    filteredPages,
    allItems,
    filteredItems,
    groupedItems,
    displayItems,
  };
}
