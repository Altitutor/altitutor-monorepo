import { cache } from 'react';
import { createClient } from '@/shared/lib/supabase/server-ssr';

export const fetchUcatStudentIdentity = cache(async (studentId: string) => {
  const supabase = createClient();
  const { data } = await supabase
    .from('vtutor_ucat_student_progress_summary')
    .select('student_name, account_class')
    .eq('student_id', studentId)
    .maybeSingle();

  return data;
});

export async function fetchUcatStudentName(studentId: string): Promise<string | undefined> {
  const identity = await fetchUcatStudentIdentity(studentId);
  return identity?.student_name ?? undefined;
}
