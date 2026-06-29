import { entityTypes } from '../config/commandPalette.config';
import { parseSubjectQualifiedSearch } from '@altitutor/shared';
import type { FilterType } from './filtering';

const FILTER_TO_ENTITY_TYPE: Partial<Record<FilterType, keyof typeof entityTypes>> = {
  student: 'students',
  staff: 'staff',
  parent: 'parents',
  class: 'classes',
  subject: 'subjects',
  task: 'tasks',
  issue: 'issues',
  project: 'projects',
  topic: 'topics',
  file: 'files',
  note: 'notes',
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
    types = [...new Set([...types, 'topics', 'files'])];
  }

  return types;
}

/** Include topic/file palette filters when using `{subject} {code}` search syntax. */
export function getEffectiveEntityFilters(
  selectedFilters: FilterType[],
  search: string,
): FilterType[] {
  if (parseSubjectQualifiedSearch(search).mode !== 'qualified') {
    return selectedFilters;
  }

  return [...new Set([...selectedFilters, 'topic', 'file'])] as FilterType[];
}

export function shouldRunEntitySearch(
  selectedFilters: FilterType[],
  allFilterTypes: FilterType[],
  search = '',
): boolean {
  return getEntitySearchTypes(selectedFilters, allFilterTypes, search).length > 0;
}
