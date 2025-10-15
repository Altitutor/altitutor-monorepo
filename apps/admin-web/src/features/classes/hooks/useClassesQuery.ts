import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesApi } from '../api/classes';
import type { Class, Student, Subject } from '@/shared/lib/supabase/database/types';

// Query Keys
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (filters: string) => [...classesKeys.lists(), { filters }] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (id: string) => [...classesKeys.details(), id] as const,
  withDetails: () => [...classesKeys.all, 'withDetails'] as const,
  withStudents: () => [...classesKeys.all, 'withStudents'] as const,
};

// Get all classes with details
export function useClassesWithDetails() {
  return useQuery({
    queryKey: classesKeys.withDetails(),
    queryFn: classesApi.getAllClassesWithDetails,
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently updated data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get all classes (basic)
export function useClasses() {
  return useQuery({
    queryKey: classesKeys.lists(),
    queryFn: classesApi.getAllClasses,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get single class with details
export function useClassWithDetails(classId: string) {
  return useQuery({
    queryKey: classesKeys.detail(classId),
    queryFn: () => classesApi.getClassWithDetails(classId),
    enabled: !!classId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single class (basic)
export function useClass(classId: string) {
  return useQuery({
    queryKey: [...classesKeys.detail(classId), 'basic'],
    queryFn: () => classesApi.getClass(classId),
    enabled: !!classId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Mutations
export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classesApi.createClass,
    onSuccess: (newClass) => {
      // Invalidate and refetch classes lists
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
      
      // Optimistically add the new class to the cache
      queryClient.setQueryData(classesKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          classes: [...(old.classes || []), newClass],
          classStudents: { ...old.classStudents, [newClass.id]: [] },
        };
      });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Class> }) =>
      classesApi.updateClass(id, data),
    onSuccess: (updatedClass, { id }) => {
      // Update the class in all relevant caches
      queryClient.setQueryData(classesKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, class: updatedClass };
      });

      // Update in the main classes list
      queryClient.setQueryData(classesKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          classes: old.classes.map((cls: Class) =>
            cls.id === id ? updatedClass : cls
          ),
        };
      });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classesApi.deleteClass,
    onSuccess: (_, deletedId) => {
      // Remove from all caches
      queryClient.removeQueries({ queryKey: classesKeys.detail(deletedId) });
      
      // Remove from lists
      queryClient.setQueryData(classesKeys.withDetails(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          classes: old.classes.filter((cls: Class) => cls.id !== deletedId),
          classStudents: Object.fromEntries(
            Object.entries(old.classStudents).filter(([id]) => id !== deletedId)
          ),
        };
      });

      // Invalidate all class queries
      queryClient.invalidateQueries({ queryKey: classesKeys.all });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) =>
      classesApi.enrollStudent(classId, studentId),
    onSuccess: (_, { classId, studentId }) => {
      // Invalidate class details to refetch with new student
      queryClient.invalidateQueries({ queryKey: classesKeys.detail(classId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.withDetails() });
      
      // Also invalidate student queries since they show class information
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

export function useUnenrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ classId, studentId }: { classId: string; studentId: string }) =>
      classesApi.unenrollStudent(classId, studentId),
    onSuccess: (_, { classId, studentId }) => {
      // Invalidate class details to refetch without the student
      queryClient.invalidateQueries({ queryKey: classesKeys.detail(classId) });
      queryClient.invalidateQueries({ queryKey: classesKeys.withDetails() });
      
      // Also invalidate student queries since they show class information
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
} 