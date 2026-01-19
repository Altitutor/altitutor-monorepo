import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables } from '@altitutor/shared';

/**
 * Hook to fetch student subjects
 */
export function useStudentSubjects(studentId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['student-subjects', studentId],
    queryFn: async () => {
      if (!studentId) return [];
      
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('students_subjects')
        .select('subject_details:subjects(*)')
        .eq('student_id', studentId);
        
      if (error) throw error;
      
      return (data || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((row: any) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: enabled && !!studentId,
  });
}
