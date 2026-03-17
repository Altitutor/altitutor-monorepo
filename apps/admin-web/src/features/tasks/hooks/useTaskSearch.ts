import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { tasksApi } from '../api/tasks';

const DEBOUNCE_MS = 200;
const SEARCH_LIMIT = 10;

export type TaskSearchResult = {
  id: string;
  title: string | null;
  status: string | null;
  due_date: string | null;
  priority: number | null;
};

export function useTaskSearch(
  search: string,
  enabled: boolean,
  options?: { excludeLinked?: boolean }
) {
  const debouncedSearch = useDebounce(search.trim(), DEBOUNCE_MS);
  const shouldSearch = enabled && debouncedSearch.length >= 1;

  const query = useQuery({
    queryKey: ['task-search', debouncedSearch, options?.excludeLinked],
    queryFn: async () => tasksApi.search(debouncedSearch, SEARCH_LIMIT, options),
    enabled: shouldSearch,
    staleTime: 30_000,
  });

  return {
    tasks: (query.data ?? []) as TaskSearchResult[],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
  };
}
