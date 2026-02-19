import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '../api/subjects';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const subjectsKeys = {
  all: ['subjects'] as const,
  lists: () => [...subjectsKeys.all, 'list'] as const,
  list: (filters: string) => [...subjectsKeys.lists(), { filters }] as const,
  details: () => [...subjectsKeys.all, 'detail'] as const,
  detail: (id: string) => [...subjectsKeys.details(), id] as const,
  search: (query: string) => [...subjectsKeys.all, 'search', query] as const,
  staff: (id: string) => [...subjectsKeys.detail(id), 'staff'] as const,
  students: (id: string) => [...subjectsKeys.detail(id), 'students'] as const,
  classes: (id: string) => [...subjectsKeys.detail(id), 'classes'] as const,
  topics: (id: string) => [...subjectsKeys.detail(id), 'topics'] as const,
  subtopics: (topicId: string) => ['topics', topicId, 'subtopics'] as const,
};

// Get all subjects
export function useSubjects() {
  return useQuery({
    queryKey: subjectsKeys.lists(),
    queryFn: subjectsApi.getAllSubjects,
    staleTime: 1000 * 60 * 5, // 5 minutes - subjects don't change often
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Paginated subject list (for pickers, filters)
export function useSubjectsList(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  curriculums?: string[];
  yearLevels?: number[];
}) {
  const {
    limit = 100,
    offset = 0,
    search,
    curriculums,
    yearLevels,
  } = params ?? {};
  return useQuery({
    queryKey: [
      ...subjectsKeys.lists(),
      'paginated',
      limit,
      offset,
      search ?? '',
      curriculums?.join(',') ?? '',
      yearLevels?.join(',') ?? '',
    ] as const,
    queryFn: () => subjectsApi.list({ limit, offset, search, curriculums, yearLevels }),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });
}

// Get single subject
export function useSubject(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.detail(subjectId),
    queryFn: () => subjectsApi.getSubject(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}

// Search subjects
export function useSubjectsSearch(query: string) {
  return useQuery({
    queryKey: subjectsKeys.search(query),
    queryFn: () => subjectsApi.searchSubjects(query),
    enabled: query.length > 0,
    staleTime: 1000 * 30, // 30 seconds for search results
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Get subject staff
export function useSubjectStaff(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.staff(subjectId),
    queryFn: () => subjectsApi.getSubjectStaff(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get subject students
export function useSubjectStudents(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.students(subjectId),
    queryFn: () => subjectsApi.getSubjectStudents(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get subject classes
export function useSubjectClasses(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.classes(subjectId),
    queryFn: () => subjectsApi.getSubjectClasses(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get subject topics
export function useSubjectTopics(subjectId: string) {
  return useQuery({
    queryKey: subjectsKeys.topics(subjectId),
    queryFn: () => subjectsApi.getSubjectTopics(subjectId),
    enabled: !!subjectId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Mutations
export function useCreateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subjectsApi.createSubject,
    onSuccess: (newSubject) => {
      // Invalidate and refetch subjects lists
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all });
      
      // Optimistically add the new subject to the cache
      queryClient.setQueryData(subjectsKeys.lists(), (old: Tables<'subjects'>[] | undefined) => {
        if (!old) return [newSubject];
        return [...old, newSubject];
      });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'subjects'> }) =>
      subjectsApi.updateSubject(id, data),
    onSuccess: (updatedSubject, { id }) => {
      // Update specific subject in cache
      queryClient.setQueryData(subjectsKeys.detail(id), updatedSubject);

      // Update in the main subjects list
      queryClient.setQueryData(subjectsKeys.lists(), (old: Tables<'subjects'>[] | undefined) => {
        if (!old) return [updatedSubject];
        return old.map((subject) =>
          subject.id === id ? updatedSubject : subject
        );
      });

      // Only invalidate subject lists - don't invalidate staff/students/classes
      // They'll refetch when needed via their own queries
      queryClient.invalidateQueries({ queryKey: subjectsKeys.lists() });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subjectsApi.deleteSubject,
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: subjectsKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(subjectsKeys.lists(), (old: Tables<'subjects'>[] | undefined) => {
        if (!old) return [];
        return old.filter((subject) => subject.id !== deletedId);
      });

      // Only invalidate subject lists - don't invalidate staff/students/classes
      queryClient.invalidateQueries({ queryKey: subjectsKeys.lists() });
    },
  });
} 