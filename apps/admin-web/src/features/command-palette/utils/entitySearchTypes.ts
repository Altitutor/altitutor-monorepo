import { entityTypes } from '../config/commandPalette.config';
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
): (keyof typeof entityTypes)[] {
  if (selectedFilters.length >= allFilterTypes.length) {
    return ALL_ENTITY_SEARCH_TYPES;
  }

  const selectedEntityTypes = selectedFilters
    .map((filter) => FILTER_TO_ENTITY_TYPE[filter])
    .filter((type): type is keyof typeof entityTypes => type !== undefined);

  const allEntityFilterCount = allFilterTypes.filter((filter) => FILTER_TO_ENTITY_TYPE[filter]).length;
  if (selectedEntityTypes.length >= allEntityFilterCount) {
    return ALL_ENTITY_SEARCH_TYPES;
  }

  return selectedEntityTypes;
}

export function shouldRunEntitySearch(
  selectedFilters: FilterType[],
  allFilterTypes: FilterType[],
): boolean {
  return getEntitySearchTypes(selectedFilters, allFilterTypes).length > 0;
}
