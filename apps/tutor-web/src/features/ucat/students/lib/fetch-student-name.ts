import { createClient } from '@/shared/lib/supabase/server-ssr'

export async function fetchUcatStudentName(studentId: string): Promise<string | undefined> {
  const supabase = createClient()
  const { data } = await supabase
    .from('vtutor_ucat_student_progress_summary')
    .select('student_name')
    .eq('student_id', studentId)
    .maybeSingle()

  return (data as { student_name?: string } | null)?.student_name ?? undefined
}
