import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { classesApi } from '../api/classes';
import type { Tables, TablesUpdate } from '@altitutor/shared';

// Query Keys
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (filters: string) => [...classesKeys.lists(), { filters }] as const,
  minimal: (params?: any) => [...classesKeys.all, 'minimal', params] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (id: string) => [...classesKeys.details(), id] as const,
  detailFull: (id: string) => [...classesKeys.detail(id), 'details'] as const,
  withDetails: () => [...classesKeys.all, 'withDetails'] as const,
  withStudents: () => [...classesKeys.all, 'withStudents'] as const,
  forStaffWithDetails: (staffId: string) => [...classesKeys.all, 'forStaffWithDetails', staffId] as const,
};

// For table display - minimal data
export interface UseClassesListParams {
  search?: string;
  dayOfWeek?: number;
  daysOfWeek?: number[];
  page?: number;
  pageSize?: number;
  orderBy?: keyof Tables<'classes'>;
  ascending?: boolean;
}

export function useClassesMinimalPaginated(params: UseClassesListParams = {}) {
  const {
    search = '',
    dayOfWeek,
    daysOfWeek = [],
    page = 1,
    pageSize = 50,
    orderBy = 'day_of_week',
    ascending = true,
  } = params;

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: classesKeys.minimal({ search, dayOfWeek, daysOfWeek, page, pageSize, orderBy, ascending }),
    queryFn: () =>
      classesApi.listMinimal({
        search,
        dayOfWeek,
        daysOfWeek,
        limit: pageSize,
        offset,
        orderBy,
        ascending,
      }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

export function useClassesMinimal(params?: { dayOfWeek?: number; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: classesKeys.minimal(params),
    queryFn: () => classesApi.listMinimal(params),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}

// For modal - full details
export function useClassDetails(classId: string, enabled = true) {
  return useQuery({
    queryKey: classesKeys.detailFull(classId),
    queryFn: () => classesApi.getClassDetails(classId),
    enabled: enabled && !!classId,
    staleTime: 1000 * 60 * 2, // 2min
    gcTime: 1000 * 60 * 5,
  });
}

// Get all classes with details
// DEPRECATED: Use useClassesMinimal() + useClassDetails() instead
export function useClassesWithDetails() {
  return useQuery({
    queryKey: classesKeys.withDetails(),
    queryFn: classesApi.getAllClassesWithDetails,
    staleTime: 1000 * 60 * 2, // 2 minutes - frequently updated data
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get classes with details for a staff member
export function useClassesForStaffWithDetails(staffId: string) {
  return useQuery({
    queryKey: classesKeys.forStaffWithDetails(staffId),
    queryFn: () => classesApi.getClassesForStaffWithDetails(staffId),
    enabled: !!staffId,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
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

// Active classes count (ACTIVE status)
export function useActiveClassesCount() {
  return useQuery({
    queryKey: [...classesKeys.all, 'activeCount'],
    queryFn: () => classesApi.getActiveClassesCount(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Current class enrollments count (unenrolled_at is null or in the future)
export function useCurrentEnrollmentsCount() {
  return useQuery({
    queryKey: [...classesKeys.all, 'currentEnrollmentsCount'],
    queryFn: () => classesApi.getCurrentEnrollmentsCount(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Mutations
export function useCreateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classesApi.createClass,
    onSuccess: () => {
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['classes', 'minimal'] });
    },
  });
}

export function useUpdateClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'classes'> }) =>
      classesApi.updateClass(id, data),
    onSuccess: (updatedClass, { id }) => {
      // Update specific entity in cache
      queryClient.setQueryData(classesKeys.detailFull(id), (old: any) => {
        if (!old) return old;
        return { ...old, class: updatedClass };
      });

      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['classes', 'minimal'] });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: classesApi.deleteClass,
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: classesKeys.detailFull(deletedId) });
      
      // Invalidate ONLY entity's minimal list
      queryClient.invalidateQueries({ queryKey: ['classes', 'minimal'] });
    },
  });
}

export function useEnrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      classId, 
      studentId, 
      enrolledAt, 
      staffId 
    }: { 
      classId: string; 
      studentId: string; 
      enrolledAt: Date; 
      staffId: string 
    }) =>
      classesApi.enrollStudent(classId, studentId, enrolledAt, staffId),
    onSuccess: (_, { classId }) => {
      // Invalidate specific class details
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classId) });
      // Also invalidate students minimal list since enrollment changed
      queryClient.invalidateQueries({ queryKey: ['students', 'minimal'] });
    },
  });
}

export function useUnenrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      classId, 
      studentId, 
      staffId, 
      unenrolledAt 
    }: { 
      classId: string; 
      studentId: string; 
      staffId: string; 
      unenrolledAt?: Date 
    }) =>
      classesApi.unenrollStudent(classId, studentId, staffId, unenrolledAt),
    onSuccess: (_, { classId }) => {
      // Invalidate specific class details
      queryClient.invalidateQueries({ queryKey: classesKeys.detailFull(classId) });
      // Also invalidate students minimal list since enrollment changed
      queryClient.invalidateQueries({ queryKey: ['students', 'minimal'] });
    },
  });
} 