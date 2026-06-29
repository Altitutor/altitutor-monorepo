import type { CommandPalettePage } from '../config/commandPalette.config';
import type { TutorCommandPaletteEntityResult } from '../types';
import { getEntityDisplayText } from './entityFormatters';

type MatchScoringItem =
  | { type: 'page'; item: CommandPalettePage }
  | { type: 'entity'; result: TutorCommandPaletteEntityResult };

function scorePage(page: CommandPalettePage, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const titleLower = page.title.toLowerCase();

  if (titleLower === queryLower) return 1000;
  if (titleLower.startsWith(queryLower)) return 900;
  if (titleLower.includes(queryLower)) return 800;
  if (page.keywords?.some((keyword) => keyword.toLowerCase().includes(queryLower))) return 600;
  return 0;
}

function scoreEntity(result: TutorCommandPaletteEntityResult, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const { title, subtitle } = getEntityDisplayText(result);
  const titleLower = title.toLowerCase();
  const subtitleLower = subtitle?.toLowerCase() || '';
  const combinedLower = `${titleLower} ${subtitleLower}`.trim();

  if (titleLower === queryLower) return 1000;
  if (titleLower.startsWith(queryLower)) return 900;
  if (titleLower.includes(queryLower)) return 800;
  if (combinedLower === queryLower) return 700;
  if (combinedLower.startsWith(queryLower)) return 600;
  if (combinedLower.includes(queryLower)) return 500;
  if (subtitleLower.includes(queryLower)) return 300;
  return 0;
}

export function calculateMatchScore(item: MatchScoringItem, query: string): number {
  if (!query.trim()) return 0;
  if (item.type === 'page') return scorePage(item.item, query);
  if (item.type === 'entity') return scoreEntity(item.result, query);
  return 0;
}
