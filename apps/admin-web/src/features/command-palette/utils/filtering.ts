/**
 * Filtering and Sorting Utilities for Command Palette
 * 
 * Handles filtering and sorting of commands, pages, and entities.
 */

import type { CommandPaletteCommand, CommandPalettePage } from '../config/commandPalette.config';
import type { CommandPaletteEntityResult } from '../types';
import { calculateMatchScore } from './matchScoring';
import type { LucideIcon } from 'lucide-react';

export type CommandPaletteItem =
  | { type: 'command'; id: string; title: string; description?: string; icon: LucideIcon; action: () => void }
  | { type: 'page'; id: string; title: string; href: string; icon: LucideIcon }
  | { type: 'entity'; result: CommandPaletteEntityResult };

export type FilterType = 'command' | 'page' | 'student' | 'staff' | 'parent' | 'class' | 'subject' | 'task' | 'issue' | 'project' | 'topic' | 'file';

/**
 * Filter and sort commands by search query
 */
export function filterAndSortCommands(
  commands: CommandPaletteCommand[],
  query: string
): CommandPaletteCommand[] {
  if (!query.trim()) return commands;

  const queryLower = query.toLowerCase();
  const filtered = commands.filter((cmd) => {
    const titleMatch = cmd.title.toLowerCase().includes(queryLower);
    const descMatch = cmd.description?.toLowerCase().includes(queryLower);
    const keywordMatch = cmd.keywords?.some((k) => k.toLowerCase().includes(queryLower));
    return titleMatch || descMatch || keywordMatch;
  });

  // Sort by match quality: exact match > starts with > contains
  return filtered.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    if (aTitle === queryLower && bTitle !== queryLower) return -1;
    if (bTitle === queryLower && aTitle !== queryLower) return 1;
    if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
    if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;
    return 0;
  });
}

/**
 * Filter and sort pages by search query
 */
export function filterAndSortPages(
  pages: CommandPalettePage[],
  query: string
): CommandPalettePage[] {
  if (!query.trim()) return pages;

  const queryLower = query.toLowerCase();
  const filtered = pages.filter((page) => {
    const titleMatch = page.title.toLowerCase().includes(queryLower);
    const keywordMatch = page.keywords?.some((k) => k.toLowerCase().includes(queryLower));
    return titleMatch || keywordMatch;
  });

  // Sort by match quality: exact match > starts with > contains
  return filtered.sort((a, b) => {
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();

    if (aTitle === queryLower && bTitle !== queryLower) return -1;
    if (bTitle === queryLower && aTitle !== queryLower) return 1;
    if (aTitle.startsWith(queryLower) && !bTitle.startsWith(queryLower)) return -1;
    if (bTitle.startsWith(queryLower) && !aTitle.startsWith(queryLower)) return 1;
    return 0;
  });
}

/**
 * Filter items by selected filter type
 */
export function filterItemsByType(
  items: CommandPaletteItem[],
  filterType: FilterType | null
): CommandPaletteItem[] {
  if (filterType === null) {
    return items;
  }

  return items.filter((item) => {
    if (item.type === 'command') {
      return filterType === 'command';
    }
    if (item.type === 'page') {
      return filterType === 'page';
    }
    if (item.type === 'entity') {
      return filterType === item.result.type;
    }
    return false;
  });
}

/**
 * Group items by type and calculate max scores for section prioritization
 */
export function groupItemsByType(
  items: CommandPaletteItem[],
  query: string,
  entityTypeMapping: Record<string, string>,
  entityTypes: Record<string, { label: string }>
): Array<{ label: string; items: CommandPaletteItem[]; maxScore: number }> {
  const groups: Array<{ label: string; items: CommandPaletteItem[]; maxScore: number }> = [];

  // Commands
  const commandItems = items.filter((i) => i.type === 'command');
  if (commandItems.length > 0) {
    const maxScore =
      commandItems.length > 0
        ? calculateMatchScore(
            { type: 'command', item: commandItems[0] as any },
            query
          )
        : 0;
    groups.push({ label: 'Commands', items: commandItems, maxScore });
  }

  // Pages
  const pageItems = items.filter((i) => i.type === 'page');
  if (pageItems.length > 0) {
    const maxScore =
      pageItems.length > 0
        ? calculateMatchScore({ type: 'page', item: pageItems[0] as any }, query)
        : 0;
    groups.push({ label: 'Pages', items: pageItems, maxScore });
  }

  // Group entities by type
  const entityGroups: Record<string, CommandPaletteItem[]> = {};
  items
    .filter((i) => i.type === 'entity')
    .forEach((item) => {
      if (item.type === 'entity') {
        const type = item.result.type;
        if (!entityGroups[type]) entityGroups[type] = [];
        entityGroups[type].push(item);
      }
    });

  Object.entries(entityGroups).forEach(([type, typeItems]) => {
    const configKey = entityTypeMapping[type] || type;
    const config = entityTypes[configKey];
    if (config) {
      // Calculate score for first item only - results are already sorted by relevance from database
      const maxScore =
        typeItems.length > 0 && typeItems[0].type === 'entity'
          ? calculateMatchScore({ type: 'entity', result: typeItems[0].result }, query)
          : 0;
      groups.push({ label: config.label, items: typeItems, maxScore });
    }
  });

  // Sort groups by maxScore (highest first), then by label for consistency
  return groups.sort((a, b) => {
    if (b.maxScore !== a.maxScore) {
      return b.maxScore - a.maxScore;
    }
    return a.label.localeCompare(b.label);
  });
}
