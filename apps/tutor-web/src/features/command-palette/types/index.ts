import type { TutorSearchEntity } from '@altitutor/shared';
import type { FilterType } from '../utils/filtering';

export type TutorCommandPaletteEntityResult = TutorSearchEntity & { href: string };

export interface UseCommandPaletteSearchOptions {
  search: string;
  enabled?: boolean;
  selectedFilters: FilterType[];
  allFilterTypes: FilterType[];
}
