import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsApi } from '../api/subjects';
import type { Tables, TablesUpdate, TablesInsert } from '@altitutor/shared';

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
      // Update the subject in the detail cache
      queryClient.setQueryData(subjectsKeys.detail(id), updatedSubject);

      // Update in the main subjects list
      queryClient.setQueryData(subjectsKeys.lists(), (old: Tables<'subjects'>[] | undefined) => {
        if (!old) return [updatedSubject];
        return old.map((subject) =>
          subject.id === id ? updatedSubject : subject
        );
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all });
      
      // Also invalidate staff and student queries since subject changes affect them
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
}

export function useDeleteSubject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subjectsApi.deleteSubject,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: subjectsKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(subjectsKeys.lists(), (old: Tables<'subjects'>[] | undefined) => {
        if (!old) return [];
        return old.filter((subject) => subject.id !== deletedId);
      });

      // Invalidate all subject queries
      queryClient.invalidateQueries({ queryKey: subjectsKeys.all });
      
      // Also invalidate staff and student queries since subject deletion affects them
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });
} 