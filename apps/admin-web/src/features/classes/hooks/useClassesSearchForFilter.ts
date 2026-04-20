import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../api/classes';

/**
 * Searchable class list for filter dropdowns (e.g. QuickBooks export).
 */
export function useClassesSearchForFilter(searchQuery: string) {
  const trimmed = searchQuery.trim();

  return useQuery({
    queryKey: ['classes', 'search-filter', trimmed],
    queryFn: async () => {
      const result = await classesApi.listMinimal({
        search: trimmed,
        limit: 100,
        offset: 0,
        orderBy: 'day_of_week',
        ascending: true,
      });
      return {
        classes: result.classes,
        total: result.total,
      };
    },
    staleTime: 1000 * 30,
  });
}
