import type { CommandPalettePage } from '../config/commandPalette.config';
import type { TutorCommandPaletteEntityResult } from '../types';
import { calculateMatchScore } from './matchScoring';
import type { LucideIcon } from 'lucide-react';

export type CommandPaletteItem =
  | { type: 'page'; id: string; title: string; href: string; icon: LucideIcon }
  | { type: 'entity'; result: TutorCommandPaletteEntityResult };

export type FilterType =
  | 'page'
  | 'subject'
  | 'topic'
  | 'file'
  | 'flashcards'
  | 'class';

export function filterAndSortPages(pages: CommandPalettePage[], query: string): CommandPalettePage[] {
  if (!query.trim()) return pages;

  const queryLower = query.toLowerCase();
  const filtered = pages.filter((page) => {
    const titleMatch = page.title.toLowerCase().includes(queryLower);
    const keywordMatch = page.keywords?.some((keyword) => keyword.toLowerCase().includes(queryLower));
    return titleMatch || keywordMatch;
  });

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

export function filterItemsByType(
  items: CommandPaletteItem[],
  filterTypes: FilterType[],
  allFilterTypes: FilterType[],
): CommandPaletteItem[] {
  if (filterTypes.length === 0 || filterTypes.length >= allFilterTypes.length) {
    return items;
  }

  const allowed = new Set(filterTypes);

  return items.filter((item) => {
    if (item.type === 'page') return allowed.has('page');
    if (item.type === 'entity') return allowed.has(item.result.type as FilterType);
    return false;
  });
}

export function groupItemsByType(
  items: CommandPaletteItem[],
  query: string,
  entityTypeMapping: Record<string, string>,
  entityTypes: Record<string, { label: string }>,
): Array<{ label: string; items: CommandPaletteItem[]; maxScore: number }> {
  const groups: Array<{ label: string; items: CommandPaletteItem[]; maxScore: number }> = [];

  const pageItems = items.filter((item) => item.type === 'page');
  if (pageItems.length > 0) {
    const maxScore =
      pageItems.length > 0 ? calculateMatchScore({ type: 'page', item: pageItems[0] }, query) : 0;
    groups.push({ label: 'Pages', items: pageItems, maxScore });
  }

  const entityGroups: Record<string, CommandPaletteItem[]> = {};
  items
    .filter((item): item is Extract<CommandPaletteItem, { type: 'entity' }> => item.type === 'entity')
    .forEach((item) => {
      const type = item.result.type;
      if (!entityGroups[type]) entityGroups[type] = [];
      entityGroups[type].push(item);
    });

  Object.entries(entityGroups).forEach(([type, typeItems]) => {
    const configKey = entityTypeMapping[type] || type;
    const config = entityTypes[configKey];
    if (!config) return;

    const maxScore =
      typeItems.length > 0 && typeItems[0].type === 'entity'
        ? calculateMatchScore({ type: 'entity', result: typeItems[0].result }, query)
        : 0;
    groups.push({ label: config.label, items: typeItems, maxScore });
  });

  return groups.sort((a, b) => {
    if (query.trim()) {
      if (b.maxScore !== a.maxScore) return b.maxScore - a.maxScore;
      return a.label.localeCompare(b.label);
    }

    const order = (label: string) => (label === 'Pages' ? 1 : 0);
    const aOrder = order(a.label);
    const bOrder = order(b.label);
    if (aOrder !== bOrder) return bOrder - aOrder;
    return a.label.localeCompare(b.label);
  });
}
