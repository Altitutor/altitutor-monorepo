import { useQuery } from '@tanstack/react-query';
import { tutorViewsApi } from '../api/tutor-views';

export const tutorLogStudentsKeys = {
  byIds: (ids: string[]) => ['tutor-log-students', 'by-ids', ids.sort().join(',')] as const,
};

/**
 * Get students by IDs for tutor log flow.
 * Uses vtutor_students view.
 */
export function useTutorLogStudents(ids: string[]) {
  return useQuery({
    queryKey: tutorLogStudentsKeys.byIds(ids),
    queryFn: () => tutorViewsApi.getStudentsByIds(ids),
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });
}
