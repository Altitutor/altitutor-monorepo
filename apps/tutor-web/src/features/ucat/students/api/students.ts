import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type VtutorClassesRow = Database['public']['Views']['vtutor_classes']['Row']
type VtutorClassDetailRow = Database['public']['Views']['vtutor_class_detail']['Row']

export type UcatClassWithDetails = (VtutorClassesRow & { id: string }) & {
  students: Array<{ id: string; first_name?: string; last_name?: string }>
  staff: Array<{ id: string; first_name?: string; last_name?: string }>
}

export type StudentProgressSummaryRow = {
  student_id: string
  student_name: string
  total_questions: number
  total_sets_attempted: number
  total_mocks_attempted: number
  exam: number | null
  last_attempted_at: string | null
  section_scores: Record<string, number | null>
}

export type StudentProgressSummaryResponse = {
  students: StudentProgressSummaryRow[]
  sections: Array<{ id: string; name: string; section_number: number }>
}

export const ucatStudentsApi = {
  async listProgressSummary(params: {
    mode: 'all_time' | 'weighted' | 'time_frame'
    timeFrameDays: string
  }): Promise<StudentProgressSummaryResponse> {
    const search = new URLSearchParams({
      mode: params.mode,
      timeFrameDays: params.timeFrameDays,
    })
    const res = await fetch(
      `/api/ucat/students/progress-summary?${search.toString()}`
    )
    if (!res.ok) throw new Error('Failed to fetch progress summary')
    return res.json()
  },

  async listProgress() {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_ucat_student_progress_summary')
      .select('*')
      .order('last_attempted_at', { ascending: false, nullsFirst: false })
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

  /** List UCAT classes with full row (time, etc.) and students/staff from vtutor_class_detail */
  async listUcatClassesWithDetails(): Promise<UcatClassWithDetails[]> {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data: classesData, error: classesError } = await supabase
      .from('vtutor_classes')
      .select('*')
      .eq('subject_name', 'UCAT')
    if (classesError) throw classesError
    const classes = (classesData ?? []).filter((c): c is VtutorClassesRow & { id: string } => c.id != null)
    if (classes.length === 0) return []

    const classIds = classes.map((c) => c.id)
    const { data: detailsData, error: detailsError } = await supabase
      .from('vtutor_class_detail')
      .select('class_id, students, staff')
      .in('class_id', classIds)
    if (detailsError) throw detailsError

    const detailsByClassId = (detailsData ?? []).reduce(
      (acc, row) => {
        const r = row as VtutorClassDetailRow & { class_id: string }
        if (r.class_id) {
          acc[r.class_id] = {
            students: (Array.isArray(r.students) ? r.students : []) as Array<{
              id: string
              first_name?: string
              last_name?: string
            }>,
            staff: (Array.isArray(r.staff) ? r.staff : []) as Array<{
              id: string
              first_name?: string
              last_name?: string
            }>,
          }
        }
        return acc
      },
      {} as Record<string, { students: UcatClassWithDetails['students']; staff: UcatClassWithDetails['staff'] }>
    )

    return classes.map((c) => ({
      ...c,
      students: detailsByClassId[c.id]?.students ?? [],
      staff: detailsByClassId[c.id]?.staff ?? [],
    }))
  },

  async classStudentIds(classId: string) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>
    const { data, error } = await supabase
      .from('vtutor_class_detail')
      .select('students')
      .eq('class_id', classId)
      .maybeSingle()

    if (error) throw error

    const raw = (data as Pick<VtutorClassDetailRow, 'students'> | null)?.students
    const students = Array.isArray(raw) ? (raw as Array<{ id: string }>) : []
    return students.map((student) => student.id)
  },
}
