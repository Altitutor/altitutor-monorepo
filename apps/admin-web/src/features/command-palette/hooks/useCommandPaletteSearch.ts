import { useEntitySearch } from '@/shared/hooks/useEntitySearch';
import { excludeDoneEntities } from '../utils/excludeDoneEntities';
import { getEntitySearchTypes, shouldRunEntitySearch } from '../utils/entitySearchTypes';
import type { UseCommandPaletteSearchOptions } from '../types';

// Re-export types for backward compatibility
export type { CommandPaletteEntityResult, UseCommandPaletteSearchOptions } from '../types';

/**
 * Hook for searching all entity types in parallel
 * Now uses the shared useEntitySearch hook
 */
export function useCommandPaletteSearch({
  search,
  enabled = true,
  selectedFilters,
  allFilterTypes,
}: UseCommandPaletteSearchOptions) {
  const entitySearchTypes = getEntitySearchTypes(selectedFilters, allFilterTypes, search);
  const canSearchEntities = shouldRunEntitySearch(selectedFilters, allFilterTypes, search);

  const { results, isLoading, hasError } = useEntitySearch({
    search,
    enabled: enabled && canSearchEntities,
    types: entitySearchTypes,
  });

  return {
    results: excludeDoneEntities(results),
    isLoading,
    hasError,
  };
}
