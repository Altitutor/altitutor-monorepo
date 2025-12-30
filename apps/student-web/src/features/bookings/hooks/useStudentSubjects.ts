import { useQuery } from '@tanstack/react-query';
import { studentSubjectsApi } from '../api/subjects';

export function useStudentSubjects() {
  return useQuery({
    queryKey: ['student-subjects', 'my'],
    queryFn: () => studentSubjectsApi.getMySubjects(),
    staleTime: 5 * 60 * 1000, // 5 minutes - subjects don't change often
  });
}

