import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../api/classes';

// Query Keys
export const classesKeys = {
  all: ['classes'] as const,
  lists: () => [...classesKeys.all, 'list'] as const,
  list: (filters: string) => [...classesKeys.lists(), { filters }] as const,
  details: () => [...classesKeys.all, 'detail'] as const,
  detail: (id: string) => [...classesKeys.details(), id] as const,
};

// Get all classes (uses vtutor_classes view)
export function useClasses() {
  return useQuery({
    queryKey: classesKeys.lists(),
    queryFn: classesApi.getAllClasses,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get single class with details (uses vtutor_class_detail view)
export function useClassWithDetails(classId: string) {
  return useQuery({
    queryKey: classesKeys.detail(classId),
    queryFn: () => classesApi.getClassWithDetails(classId),
    enabled: !!classId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Get single class (basic, uses vtutor_classes view)
export function useClass(classId: string) {
  return useQuery({
    queryKey: [...classesKeys.detail(classId), 'basic'],
    queryFn: () => classesApi.getClass(classId),
    enabled: !!classId,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

// Get classes by day of week
export function useClassesByDay(dayOfWeek: number) {
  return useQuery({
    queryKey: [...classesKeys.lists(), 'byDay', dayOfWeek],
    queryFn: () => classesApi.getClassesByDay(dayOfWeek),
    enabled: dayOfWeek >= 0 && dayOfWeek <= 6,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}

// Get classes by status
export function useClassesByStatus(status: string) {
  return useQuery({
    queryKey: [...classesKeys.lists(), 'byStatus', status],
    queryFn: () => classesApi.getClassesByStatus(status),
    enabled: !!status,
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 10,
  });
}
