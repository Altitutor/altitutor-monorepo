import { useEntitySearch } from '@/shared/hooks/useEntitySearch';
import { entityTypes } from '../config/commandPalette.config';
import type { CommandPaletteEntityResult, UseCommandPaletteSearchOptions } from '../types';

// Re-export types for backward compatibility
export type { CommandPaletteEntityResult, UseCommandPaletteSearchOptions } from '../types';

/**
 * Hook for searching all entity types in parallel
 * Now uses the shared useEntitySearch hook
 */
export function useCommandPaletteSearch({ search, enabled = true }: UseCommandPaletteSearchOptions) {
  const { results, isLoading, hasError } = useEntitySearch({ 
    search, 
    enabled,
    types: Object.keys(entityTypes) as (keyof typeof entityTypes)[]
  });

  const filteredResults = results.filter((result) => {
    if (result.type === 'task') {
      return result.data.status !== 'done';
    }

    if (result.type === 'issue') {
      return result.data.status !== 'resolved';
    }

    return true;
  });

  return {
    results: filteredResults,
    isLoading,
    hasError,
  };
}
