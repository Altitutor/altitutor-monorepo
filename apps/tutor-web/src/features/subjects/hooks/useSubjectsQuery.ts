import { useQuery } from '@tanstack/react-query';
import { subjectsApi } from '../api/subjects';

// Query Keys
export const subjectsKeys = {
  all: ['subjects'] as const,
  lists: () => [...subjectsKeys.all, 'list'] as const,
  list: (filters: string) => [...subjectsKeys.lists(), { filters }] as const,
  details: () => [...subjectsKeys.all, 'detail'] as const,
  detail: (id: string) => [...subjectsKeys.details(), id] as const,
  search: (query: string) => [...subjectsKeys.all, 'search', query] as const,
};

// Get all subjects (uses vtutor_subjects view)
export function useSubjects() {
  return useQuery({
    queryKey: subjectsKeys.lists(),
    queryFn: subjectsApi.getAllSubjects,
    staleTime: 1000 * 60 * 5, // 5 minutes - subjects don't change often
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Get single subject (uses vtutor_subjects view)
export function useSubject(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.detail(subjectId),
    queryFn: () => subjectsApi.getSubject(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Search subjects (uses vtutor_subjects view)
export function useSubjectsSearch(query: string) {
  return useQuery({
    queryKey: subjectsKeys.search(query),
    queryFn: () => subjectsApi.searchSubjects(query),
    enabled: query.length > 0,
    staleTime: 1000 * 30, // 30 seconds for search results
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}
