import { useQuery } from '@tanstack/react-query';
import { studentSubjectsApi } from '../api/subjects';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function useStudentSubjects() {
  const { user } = useAuthStore();
  const isAuthenticated = !!user;
  
  return useQuery({
    queryKey: ['student-subjects', 'my'],
    queryFn: () => studentSubjectsApi.getMySubjects(),
    enabled: isAuthenticated, // Only fetch if authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes - subjects don't change often
  });
}

