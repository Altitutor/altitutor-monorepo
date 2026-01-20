/**
 * Command Palette Utilities
 */

export { getEntityDisplayText } from './entityFormatters';
export type { EntityDisplayText } from './entityFormatters';

export { calculateMatchScore } from './matchScoring';
export type { CommandPaletteItem } from './filtering';

export {
  filterAndSortCommands,
  filterAndSortPages,
  filterItemsByType,
  groupItemsByType,
} from './filtering';
export type { FilterType } from './filtering';

export { highlightText } from './highlighting';
