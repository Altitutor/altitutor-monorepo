import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { SECTION_NUMBER_TO_NAME } from '@/features/sets/lib/section-labels'

export type MockAttemptSectionScore = {
  sectionName: string
  sectionNumber: number
  scorePoints: number | null
  totalPoints: number | null
}

export type MockAttemptWithBreakdown = {
  id: string
  attemptedAt: string
  completedAt: string | null
  scorePoints: number | null
  totalPoints: number | null
  scaledScore: number | null
  sectionScores: MockAttemptSectionScore[]
}

export async function getMockAttemptsWithBreakdown(
  mockId: string
): Promise<MockAttemptWithBreakdown[]> {
  const supabase = getSupabaseBrowserClient()

  const { data: mockAttemptsRaw, error: mockErr } = await supabase
    .from('vstudent_ucat_my_mock_attempts')
    .select('id, attempted_at, completed_at')
    .eq('ucat_mock_id', mockId)
    .not('completed_at', 'is', null)
    .order('attempted_at', { ascending: false })

  if (mockErr) throw new Error(mockErr.message ?? 'Failed to load mock attempts')
  if (!mockAttemptsRaw || mockAttemptsRaw.length === 0) return []

  const mockAttemptIds = mockAttemptsRaw.map((r) => r.id).filter(Boolean) as string[]

  const { data: mockDetail } = await supabase
    .from('vstudent_ucat_mock_detail')
    .select('sets')
    .eq('id', mockId)
    .single()

  const sets = (mockDetail?.sets as Array<{ id: string }> | null) ?? []
  const setIdsInOrder = sets.map((s) => s.id).filter(Boolean)

  const { data: setDetails } =
    setIdsInOrder.length > 0
      ? await supabase
          .from('vstudent_ucat_question_sets')
          .select('id, sections')
          .in('id', setIdsInOrder)
      : { data: [] }

  const sectionsBySetId = new Map<
    string,
    { sectionNumber: number; sectionName: string }
  >()
  for (const s of setDetails ?? []) {
    const sections = (s.sections as Array<{ section_number?: number; name?: string }> | null) ?? []
    const first = sections[0]
    const sectionNumber = first?.section_number ?? 1
    const sectionName =
      first?.name ?? SECTION_NUMBER_TO_NAME[sectionNumber] ?? `Section ${sectionNumber}`
    if (s.id) sectionsBySetId.set(s.id, { sectionNumber, sectionName })
  }

  const { data: setAttemptsRaw, error: setErr } = await supabase
    .from('vstudent_ucat_my_set_attempts')
    .select('id, student_ucat_mock_attempt_id, question_set_id, score_points, total_points, scaled_score')
    .in('student_ucat_mock_attempt_id', mockAttemptIds)
    .not('completed_at', 'is', null)

  if (setErr) throw new Error(setErr.message ?? 'Failed to load set attempts')

  const setAttemptsByMockAttempt = new Map<
    string,
    Array<{ questionSetId: string; scorePoints: number | null; totalPoints: number | null; scaledScore: number | null }>
  >()
  for (const row of setAttemptsRaw ?? []) {
    const mockAttemptId = row.student_ucat_mock_attempt_id
    if (!mockAttemptId) continue
    const list = setAttemptsByMockAttempt.get(mockAttemptId) ?? []
    list.push({
      questionSetId: row.question_set_id ?? '',
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
    })
    setAttemptsByMockAttempt.set(mockAttemptId, list)
  }

  const result: MockAttemptWithBreakdown[] = []
  for (const ma of mockAttemptsRaw) {
    const childSetAttempts = setAttemptsByMockAttempt.get(ma.id ?? '') ?? []
    const childBySetId = new Map(childSetAttempts.map((c) => [c.questionSetId, c]))

    const sectionScores: MockAttemptSectionScore[] = setIdsInOrder.map((setId) => {
      const sec = sectionsBySetId.get(setId) ?? {
        sectionNumber: 0,
        sectionName: 'Unknown',
      }
      const attempt = childBySetId.get(setId)
      return {
        sectionName: sec.sectionName,
        sectionNumber: sec.sectionNumber,
        scorePoints: attempt?.scorePoints ?? null,
        totalPoints: attempt?.totalPoints ?? null,
      }
    })

    const scorePoints = childSetAttempts.reduce((sum, c) => sum + (c.scorePoints ?? 0), 0)
    const totalPoints = childSetAttempts.reduce((sum, c) => sum + (c.totalPoints ?? 0), 0)
    const scaledScore = childSetAttempts.reduce(
      (sum, c) => sum + (c.scaledScore ?? 0),
      0
    )

    result.push({
      id: ma.id ?? '',
      attemptedAt: ma.attempted_at ?? '',
      completedAt: ma.completed_at,
      scorePoints: totalPoints > 0 ? scorePoints : null,
      totalPoints: totalPoints > 0 ? totalPoints : null,
      scaledScore: totalPoints > 0 ? scaledScore : null,
      sectionScores,
    })
  }

  return result
}

export async function getAttemptedMockIds(): Promise<Set<string>> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_my_mock_attempts')
    .select('ucat_mock_id')
    .not('completed_at', 'is', null)
  if (error) throw new Error(error.message ?? 'Failed to load attempted mocks')
  const ids = new Set<string>()
  for (const row of data ?? []) {
    if (row.ucat_mock_id) ids.add(row.ucat_mock_id)
  }
  return ids
}

export type StudentMockRow = {
  id: string
  name: string | null
  created_at: string | null
  updated_at: string | null
  created_by: string | null
  set_count: number | null
  has_timed_sets: boolean | null
}

export type MocksFilters = {
  timed?: 'timed' | 'untimed' | 'all'
  source?: 'my' | 'public' | 'all'
}

export async function getStudentMocks(): Promise<StudentMockRow[]> {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('vstudent_ucat_mocks')
    .select('id,name,created_at,updated_at,created_by,set_count,has_timed_sets')
  if (error) throw new Error(error.message ?? 'Failed to load mocks')
  return (data ?? []) as StudentMockRow[]
}

export function filterMocks(mocks: StudentMockRow[], filters: MocksFilters): StudentMockRow[] {
  return mocks.filter((mock) => {
    if (filters.timed === 'timed' && !mock.has_timed_sets) {
      return false
    }
    if (filters.timed === 'untimed' && mock.has_timed_sets) {
      return false
    }
    if (filters.source === 'my') {
      return false
    }
    return true
  })
}
