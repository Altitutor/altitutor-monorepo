import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export type SetSectionJson = {
  section_number?: number
  name?: string
  time_per_question?: number | null
}

export type StudentSetRow = {
  id: string
  name?: unknown
  description: unknown
  time_limit_seconds: number | null
  is_student_generated: boolean | null
  sections: SetSectionJson[] | null
  created_at: string | null
  updated_at: string | null
}

export type SetsFilters = {
  search?: string
  timed?: 'timed' | 'untimed' | 'all'
  source?: 'my' | 'public' | 'all'
  sectionNumber?: number | null
  attempted?: 'all' | 'unattempted'
}

export async function getStudentSets(): Promise<StudentSetRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_question_sets')
    .select('id,name,description,time_limit_seconds,is_student_generated,sections,created_at,updated_at')
  if (error) throw new Error(error.message ?? 'Failed to load sets')
  return (data ?? []) as StudentSetRow[]
}

export type SetAttemptRow = {
  id: string
  attemptedAt: string
  completedAt: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
}

export async function getSetAttempts(setId: string): Promise<SetAttemptRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_my_set_attempts')
    .select('id, attempted_at, completed_at, score_points, total_points, scaled_score')
    .eq('question_set_id', setId)
    .not('completed_at', 'is', null)
    .order('attempted_at', { ascending: false })
  if (error) throw new Error(error.message ?? 'Failed to load set attempts')
  return (data ?? []).map((row) => ({
    id: row.id ?? '',
    attemptedAt: row.attempted_at ?? '',
    completedAt: row.completed_at,
    scorePoints: row.score_points,
    totalPoints: row.total_points,
    scaledScore: row.scaled_score,
  }))
}

export async function getAttemptedSetIds(): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_my_set_attempts')
    .select('question_set_id')
    .not('completed_at', 'is', null)
  if (error) throw new Error(error.message ?? 'Failed to load attempted sets')
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.question_set_id) ids.add(row.question_set_id)
  }
  return ids
}

export function filterSets(
  sets: StudentSetRow[],
  filters: SetsFilters,
  attemptedSetIds?: Set<string>,
  extractText?: (value: unknown) => string
): StudentSetRow[] {
  const getText = extractText ?? ((v: unknown) => (typeof v === 'string' ? v : ''))
  return sets.filter((set) => {
    if (filters.search?.trim()) {
      const searchLower = filters.search.trim().toLowerCase()
      const nameText = getText(set.name) ?? ''
      const descText = getText(set.description) ?? ''
      const combined = `${nameText} ${descText}`.toLowerCase()
      if (!combined.includes(searchLower)) return false
    }
    if (filters.timed === 'timed' && (set.time_limit_seconds == null || set.time_limit_seconds <= 0)) {
      return false
    }
    if (filters.timed === 'untimed' && set.time_limit_seconds != null && set.time_limit_seconds > 0) {
      return false
    }
    if (filters.source === 'my' && !set.is_student_generated) {
      return false
    }
    if (filters.source === 'public' && set.is_student_generated) {
      return false
    }
    if (filters.sectionNumber != null) {
      const sections = Array.isArray(set.sections) ? set.sections : []
      const hasSection = sections.some((s) => s.section_number === filters.sectionNumber)
      if (!hasSection) return false
    }
    if (filters.attempted === 'unattempted' && attemptedSetIds?.has(set.id)) {
      return false
    }
    return true
  })
}
