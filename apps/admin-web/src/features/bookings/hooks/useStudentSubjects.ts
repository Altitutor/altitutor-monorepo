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
      
      type StudentSubjectRow = { subject_details: Tables<'subjects'> | null };
      return (data || [])
        .map((row: StudentSubjectRow) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];
    },
    enabled: enabled && !!studentId,
  });
}
