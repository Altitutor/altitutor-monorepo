import { useInfiniteQuery } from '@tanstack/react-query';
import { searchApi, type GlobalSearchResult } from '@/shared/api/search';

export type UseGlobalSearchOptions = {
  search: string;
  limit?: number;
  weights?: {
    primary?: number;
    secondary?: number;
  };
};

export function useGlobalSearch({ search, limit = 10, weights }: UseGlobalSearchOptions) {
  return useInfiniteQuery({
    queryKey: ['globalSearch', search.trim(), limit, weights],
    queryFn: ({ pageParam = 0 }) => 
      searchApi.global({ 
        search: search.trim(), 
        limit, 
        offset: pageParam * limit,
        weights 
      }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.has_more) {
        return pages.length;
      }
      return undefined;
    },
    enabled: search.trim().length >= 2, // Only search with 2+ characters
    staleTime: 30000, // Cache for 30 seconds
    initialPageParam: 0,
  });
}

/**
 * Flatten all pages of results into a single array
 */
export function flattenGlobalSearchResults(
  data: ReturnType<typeof useGlobalSearch>['data']
): GlobalSearchResult[] {
  if (!data) return [];
  return data.pages.flatMap(page => page.results);
}

