import { useQuery } from '@tanstack/react-query';
import { subjectsSearchApi } from '@/shared/api/subjects-search';

interface UseSubjectsSearchParams {
  curriculum?: string | null;
  yearLevel?: string | number | null;
}

/**
 * Fetches subjects filtered by curriculum and year level.
 * Used for trial contact form and registration (public, no auth required).
 */
export function useSubjectsSearch({ curriculum, yearLevel }: UseSubjectsSearchParams) {
  return useQuery({
    queryKey: ['subjects', 'search', curriculum ?? null, yearLevel ?? null],
    queryFn: () =>
      subjectsSearchApi.search({
        curriculum: curriculum ?? undefined,
        yearLevel: yearLevel ?? undefined,
        limit: 100,
      }),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface UseSubjectSearchWithTermParams {
  searchTerm: string;
  enabled?: boolean;
}

/**
 * Fetches subjects by search term (ignores curriculum/year level filters).
 * Uses debounced searchTerm - typically 300ms delay from parent.
 */
export function useSubjectSearchWithTerm({
  searchTerm,
  enabled = true,
}: UseSubjectSearchWithTermParams) {
  return useQuery({
    queryKey: ['subjects', 'search-term', searchTerm],
    queryFn: () =>
      subjectsSearchApi.search({
        search: searchTerm,
        limit: 100,
      }),
    enabled: enabled && searchTerm.trim().length > 0,
    staleTime: 1000 * 60 * 2,
  });
}
