import { entityTypes } from '../config/commandPalette.config';
import { parseSubjectQualifiedSearch } from '@altitutor/shared';
import type { FilterType } from './filtering';

const FILTER_TO_ENTITY_TYPE: Partial<Record<FilterType, keyof typeof entityTypes>> = {
  subject: 'subjects',
  topic: 'topics',
  file: 'files',
  flashcards: 'flashcards',
  class: 'classes',
};

const ALL_ENTITY_SEARCH_TYPES = Object.values(FILTER_TO_ENTITY_TYPE).filter(
  (type): type is keyof typeof entityTypes => type !== undefined,
);

export function getEntitySearchTypes(
  selectedFilters: FilterType[],
  allFilterTypes: FilterType[],
  search = '',
): (keyof typeof entityTypes)[] {
  let types: (keyof typeof entityTypes)[];

  if (selectedFilters.length >= allFilterTypes.length) {
    types = ALL_ENTITY_SEARCH_TYPES;
  } else {
    const selectedEntityTypes = selectedFilters
      .map((filter) => FILTER_TO_ENTITY_TYPE[filter])
      .filter((type): type is keyof typeof entityTypes => type !== undefined);

    const allEntityFilterCount = allFilterTypes.filter((filter) => FILTER_TO_ENTITY_TYPE[filter]).length;
    types =
      selectedEntityTypes.length >= allEntityFilterCount ? ALL_ENTITY_SEARCH_TYPES : selectedEntityTypes;
  }

  if (parseSubjectQualifiedSearch(search).mode === 'qualified') {
    types = [...new Set([...types, 'topics', 'files', 'flashcards'])];
  }

  return types;
}

export function getEffectiveEntityFilters(
  selectedFilters: FilterType[],
  search: string,
): FilterType[] {
  if (parseSubjectQualifiedSearch(search).mode !== 'qualified') {
    return selectedFilters;
  }

  return [...new Set([...selectedFilters, 'topic', 'file', 'flashcards'])] as FilterType[];
}

export function shouldRunEntitySearch(
  selectedFilters: FilterType[],
  allFilterTypes: FilterType[],
  search = '',
): boolean {
  return getEntitySearchTypes(selectedFilters, allFilterTypes, search).length > 0;
}
