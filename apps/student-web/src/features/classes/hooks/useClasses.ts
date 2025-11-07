import { useQuery } from '@tanstack/react-query';
import { classesApi } from '../api';

export function useStudentClasses() {
  return useQuery({
    queryKey: ['student', 'classes'],
    queryFn: classesApi.list,
  });
}

export function useClassDetails(classId: string | null) {
  return useQuery({
    queryKey: ['student', 'class', classId],
    queryFn: () => {
      if (!classId) throw new Error('Class ID is required');
      return classesApi.getDetails(classId);
    },
    enabled: !!classId,
  });
}

export function useClassSessions(classId: string | null) {
  return useQuery({
    queryKey: ['student', 'class', classId, 'sessions'],
    queryFn: () => {
      if (!classId) throw new Error('Class ID is required');
      return classesApi.getSessions(classId);
    },
    enabled: !!classId,
  });
}

