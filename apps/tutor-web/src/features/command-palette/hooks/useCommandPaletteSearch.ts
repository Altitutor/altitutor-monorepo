import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { getEntitySearchTypes, shouldRunEntitySearch } from '../utils/entitySearchTypes';
import { searchCommandPaletteEntities } from '../api/search';
import type { UseCommandPaletteSearchOptions } from '../types';

export function useCommandPaletteSearch({
  search,
  enabled = true,
  selectedFilters,
  allFilterTypes,
}: UseCommandPaletteSearchOptions) {
  const debouncedSearch = useDebounce(search, 250);
  const trimmedSearch = debouncedSearch.trim();
  const entitySearchTypes = getEntitySearchTypes(selectedFilters, allFilterTypes, search);
  const canSearchEntities = shouldRunEntitySearch(selectedFilters, allFilterTypes, search);
  const shouldSearch = enabled && canSearchEntities && trimmedSearch.length >= 2;

  const query = useQuery({
    queryKey: ['tutor-command-palette-search', trimmedSearch, entitySearchTypes],
    queryFn: () => searchCommandPaletteEntities(trimmedSearch, entitySearchTypes),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  return {
    results: query.data ?? [],
    isLoading: shouldSearch && query.isLoading,
    hasError: query.isError,
  };
}
