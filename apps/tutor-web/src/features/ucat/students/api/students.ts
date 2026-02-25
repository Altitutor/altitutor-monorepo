import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

export const ucatStudentsApi = {
  async listProgress() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_student_progress_summary')
      .select('*')
      .order('last_attempted_at', { ascending: false, nullsFirst: false })
    if (error) throw error
    return data ?? []
  },

  async studentSetAttempts(studentId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_student_set_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async studentMockAttempts(studentId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_student_mock_attempts')
      .select('*')
      .eq('student_id', studentId)
      .order('attempted_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async studentSummary(studentId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_student_progress_summary')
      .select('*')
      .eq('student_id', studentId)
      .maybeSingle()
    if (error) throw error
    return data
  },

  async ucatClasses() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_classes')
      .select('id,subject_name')
      .eq('subject_name', 'UCAT')
    if (error) throw error
    return data ?? []
  },

  async classStudentIds(classId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_class_detail')
      .select('students')
      .eq('class_id', classId)
      .maybeSingle()

    if (error) throw error

    const students = ((data as any)?.students ?? []) as Array<{ id: string }>
    return students.map((student) => student.id)
  },
}
