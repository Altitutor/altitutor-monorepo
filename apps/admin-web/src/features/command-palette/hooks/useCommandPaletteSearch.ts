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

  return {
    results,
    isLoading,
    hasError,
  };
}
