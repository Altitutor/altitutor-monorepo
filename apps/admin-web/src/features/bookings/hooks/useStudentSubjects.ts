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
      const [ssRes, manualRes] = await Promise.all([
        supabase
          .from('students_subjects')
          .select('subject_details:subjects(*)')
          .eq('student_id', studentId),
        supabase
          .from('students_online_access_manual')
          .select('subject_details:subjects(*)')
          .eq('student_id', studentId),
      ]);
      if (ssRes.error) throw ssRes.error;
      if (manualRes.error) throw manualRes.error;

      type StudentSubjectRow = { subject_details: Tables<'subjects'> | null };
      const byId = new Map<string, Tables<'subjects'>>();
      for (const row of [...(ssRes.data ?? []), ...(manualRes.data ?? [])] as StudentSubjectRow[]) {
        const s = row.subject_details;
        if (s?.id) byId.set(s.id, s);
      }
      return [...byId.values()];
    },
    enabled: enabled && !!studentId,
  });
}
