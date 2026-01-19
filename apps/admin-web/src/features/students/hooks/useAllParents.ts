import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../api';

interface UseAllParentsProps {
  enabled?: boolean;
}

/**
 * Hook for fetching all parents (for search/selection)
 */
export function useAllParents({ enabled = true }: UseAllParentsProps = {}) {
  return useQuery({
    queryKey: ['students', 'all-parents'],
    queryFn: () => studentsApi.getAllParents(),
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
