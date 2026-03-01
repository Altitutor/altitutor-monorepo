import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type StudentSetRow = {
  id: string
  name?: unknown
  description: unknown
  time_limit_seconds: number | null
  is_student_generated: boolean | null
  created_at: string | null
  updated_at: string | null
}

export async function getStudentSets(): Promise<StudentSetRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_question_sets')
    .select('id,name,description,time_limit_seconds,is_student_generated,created_at,updated_at')
  if (error) throw new Error(error.message ?? 'Failed to load sets')
  return (data ?? []) as StudentSetRow[]
}
