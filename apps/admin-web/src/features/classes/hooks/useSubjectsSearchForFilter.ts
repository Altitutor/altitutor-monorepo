import { useQuery } from '@tanstack/react-query';
import { subjectsApi } from '@/features/subjects/api/subjects';
import type { Tables } from '@altitutor/shared';

/**
 * Hook for searching subjects in filter dropdowns
 * Uses subjectsApi.list to support both search and "show all" scenarios
 */
export function useSubjectsSearchForFilter(searchQuery: string) {
  const trimmed = searchQuery.trim();

  return useQuery({
    queryKey: ['subjects', 'search-filter', trimmed],
    queryFn: async () => {
      const result = await subjectsApi.list({
        search: trimmed,
        limit: 100,
        offset: 0,
        orderBy: 'name',
        ascending: true,
      });
      return {
        subjects: (result.subjects || []) as Tables<'subjects'>[],
        total: result.total || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}
