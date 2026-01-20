/**
 * Match Scoring Utilities for Command Palette
 * 
 * Calculates relevance scores for search results to prioritize sections.
 */

import type { CommandPaletteCommand, CommandPalettePage } from '../config/commandPalette.config';
import type { CommandPaletteEntityResult } from '../types';
import { getEntityDisplayText } from './entityFormatters';

// Internal type for match scoring (uses config types directly)
type MatchScoringItem =
  | { type: 'command'; item: CommandPaletteCommand }
  | { type: 'page'; item: CommandPalettePage }
  | { type: 'entity'; result: CommandPaletteEntityResult };

/**
 * Calculate match quality score for a command
 */
function scoreCommand(command: CommandPaletteCommand, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const titleLower = command.title.toLowerCase();

  // Exact match (highest priority)
  if (titleLower === queryLower) return 1000;
  // Starts with query
  if (titleLower.startsWith(queryLower)) return 900;
  // Contains query
  if (titleLower.includes(queryLower)) return 800;

  // Check description
  if (command.description) {
    const descLower = command.description.toLowerCase();
    if (descLower.includes(queryLower)) return 700;
  }

  // Check keywords
  if (command.keywords?.some((k) => k.toLowerCase().includes(queryLower))) {
    return 600;
  }

  return 0;
}

/**
 * Calculate match quality score for a page
 */
function scorePage(page: CommandPalettePage, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const titleLower = page.title.toLowerCase();

  // Exact match (highest priority)
  if (titleLower === queryLower) return 1000;
  // Starts with query
  if (titleLower.startsWith(queryLower)) return 900;
  // Contains query
  if (titleLower.includes(queryLower)) return 800;

  // Check keywords
  if (page.keywords?.some((k) => k.toLowerCase().includes(queryLower))) {
    return 600;
  }

  return 0;
}

/**
 * Calculate match quality score for an entity
 */
function scoreEntity(result: CommandPaletteEntityResult, query: string): number {
  const queryLower = query.toLowerCase().trim();
  const { title, subtitle } = getEntityDisplayText(result);

  const titleLower = title.toLowerCase();
  const subtitleLower = subtitle?.toLowerCase() || '';
  const combinedLower = `${titleLower} ${subtitleLower}`.trim();

  // Exact match in title (highest priority)
  if (titleLower === queryLower) return 1000;
  // Starts with query in title
  if (titleLower.startsWith(queryLower)) return 900;
  // Contains query in title
  if (titleLower.includes(queryLower)) return 800;
  // Exact match in combined (title + subtitle)
  if (combinedLower === queryLower) return 700;
  // Starts with query in combined
  if (combinedLower.startsWith(queryLower)) return 600;
  // Contains query in combined
  if (combinedLower.includes(queryLower)) return 500;
  // Contains query in subtitle only
  if (subtitleLower.includes(queryLower)) return 300;

  return 0;
}

/**
 * Calculate match quality score for any command palette item
 */
export function calculateMatchScore(
  item: MatchScoringItem,
  query: string
): number {
  if (!query.trim()) return 0;

  if (item.type === 'command') {
    return scoreCommand(item.item, query);
  }

  if (item.type === 'page') {
    return scorePage(item.item, query);
  }

  if (item.type === 'entity') {
    return scoreEntity(item.result, query);
  }

  return 0;
}
