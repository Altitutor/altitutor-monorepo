import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subjectsApi } from '../api/subjects';
import { subjectsKeys } from './useSubjectsQuery';

interface UseSubjectSearchOptions {
  searchQuery: string;
  isOpen: boolean;
  limit?: number;
}

/**
 * Hook for debounced subject search with React Query
 * Handles both empty query (all subjects) and search query scenarios
 */
export function useSubjectSearch({
  searchQuery,
  isOpen,
  limit = 100,
}: UseSubjectSearchOptions) {
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);

  // Debounce the search query
  useEffect(() => {
    if (!isOpen) {
      setDebouncedQuery('');
      return;
    }

    const timeoutId = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen]);

  // Use React Query for fetching subjects
  const trimmedQuery = debouncedQuery.trim();
  const shouldFetch = isOpen;
  
  const query = useQuery({
    queryKey: [...subjectsKeys.lists(), 'search', trimmedQuery, limit],
    queryFn: async () => {
      if (trimmedQuery.length === 0) {
        // Fetch all subjects when no search query
        const { subjects } = await subjectsApi.list({ limit, offset: 0 });
        return subjects;
      } else {
        // Search with query
        const { subjects } = await subjectsApi.list({
          search: trimmedQuery,
          limit,
          offset: 0,
        });
        return subjects;
      }
    },
    enabled: shouldFetch,
    staleTime: 1000 * 30, // 30 seconds for search results
    gcTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    subjects: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
