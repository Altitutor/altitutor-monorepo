/**
 * Hook for filtering and sorting command palette items
 */

import { useMemo } from 'react';
import type { CommandPaletteCommand, CommandPalettePage } from '../config/commandPalette.config';
import type { CommandPaletteEntityResult } from '../types';
import { filterAndSortCommands, filterAndSortPages, filterItemsByType, groupItemsByType } from '../utils/filtering';
import type { FilterType, CommandPaletteItem } from '../utils/filtering';

// Re-export for convenience
export type { CommandPaletteItem };

interface UseCommandPaletteFilteringOptions {
  commands: CommandPaletteCommand[];
  pages: CommandPalettePage[];
  entityResults: CommandPaletteEntityResult[];
  searchQuery: string;
  selectedFilter: FilterType | null;
  entityTypeMapping: Record<string, string>;
  entityTypes: Record<string, { label: string }>;
}

export function useCommandPaletteFiltering({
  commands,
  pages,
  entityResults,
  searchQuery,
  selectedFilter,
  entityTypeMapping,
  entityTypes,
}: UseCommandPaletteFilteringOptions) {
  // Filter and sort commands
  const filteredCommands = useMemo(
    () => filterAndSortCommands(commands, searchQuery),
    [commands, searchQuery]
  );

  // Filter and sort pages
  const filteredPages = useMemo(
    () => filterAndSortPages(pages, searchQuery),
    [pages, searchQuery]
  );

  // Combine all items
  const allItems: CommandPaletteItem[] = useMemo(() => {
    const items: CommandPaletteItem[] = [];

    // Commands first
    filteredCommands.forEach((cmd) => {
      items.push({ type: 'command', ...cmd });
    });

    // Pages second
    filteredPages.forEach((page) => {
      items.push({ type: 'page', ...page });
    });

    // Entities last
    entityResults.forEach((result) => {
      items.push({ type: 'entity', result });
    });

    return items;
  }, [filteredCommands, filteredPages, entityResults]);

  // Filter items by selected filter type
  const filteredItems = useMemo(
    () => filterItemsByType(allItems, selectedFilter),
    [allItems, selectedFilter]
  );

  // Group items by type for display
  const groupedItems = useMemo(
    () =>
      groupItemsByType(filteredItems, searchQuery, entityTypeMapping, entityTypes),
    [filteredItems, searchQuery, entityTypeMapping, entityTypes]
  );

  return {
    filteredCommands,
    filteredPages,
    allItems,
    filteredItems,
    groupedItems,
  };
}
