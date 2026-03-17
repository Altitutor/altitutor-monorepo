import { NextRequest, NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  type ProgressMode,
  type TimeFrameDays,
  isInTimeFrame,
  TIME_FRAME_OPTIONS,
} from '@/features/ucat/students/progress/lib/progress-mode'

const EMA_ALPHA = 0.5

function computeEma(scores: number[]): number | null {
  if (scores.length === 0) return null
  let ema = scores[0]
  for (let i = 1; i < scores.length; i++) {
    ema = EMA_ALPHA * scores[i] + (1 - EMA_ALPHA) * ema
  }
  return ema
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

export async function GET(request: NextRequest) {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { searchParams } = new URL(request.url)
  const mode = (searchParams.get('mode') ?? 'all_time') as ProgressMode
  const timeFrameDays = (searchParams.get('timeFrameDays') ??
    TIME_FRAME_OPTIONS[2].value) as TimeFrameDays
  const days = parseInt(timeFrameDays, 10) || 30

  const supabase = access.userClient

  const filterByTime =
    mode === 'time_frame' || mode === 'weighted'
      ? (dateStr: string | null) =>
          dateStr ? isInTimeFrame(dateStr, days) : false
      : () => true

  const countsUseTimeFilter = mode !== 'weighted'

  type StudentRow = { student_id: string | null; student_name: string | null }
  const { data: studentsData } = await supabase
    .from('vtutor_ucat_student_progress_summary')
    .select('student_id, student_name')
    .order('student_name')

  const students = (studentsData ?? []) as StudentRow[]
  if (students.length === 0) {
    return NextResponse.json({ students: [], sections: [] })
  }

  const studentIds = students
    .map((s) => s.student_id)
    .filter((id): id is string => !!id)

  type SectionRow = { id: string | null; name: string | null; section_number: number | null }
  const { data: sectionsData } = await supabase
    .from('vtutor_ucat_sections')
    .select('id, name, section_number')
    .order('section_number')

  const sectionList = ((sectionsData ?? []) as SectionRow[]).filter(
    (s): s is SectionRow & { id: string } => s.id != null
  )
  const sectionByNumber = new Map(
    sectionList.map((s) => [s.section_number ?? 0, s.id!])
  )

  const { data: qaRaw } = await supabase
    .from('vtutor_ucat_student_question_attempts_for_progress')
    .select('student_id, attempted_at, is_submitted')
    .in('student_id', studentIds)
    .eq('is_submitted', true)

  const { data: setAttemptsRaw } = await supabase
    .from('vtutor_ucat_student_set_attempts')
    .select('student_id, attempted_at, completed_at, scaled_score, set_id')
    .in('student_id', studentIds)
    .not('completed_at', 'is', null)

  const setIds = [
    ...new Set(
      (setAttemptsRaw ?? [])
        .map((r: { set_id?: string | null }) => r.set_id)
        .filter(Boolean)
    ),
  ] as string[]

  const { data: setDetails } =
    setIds.length > 0
      ? await supabase
          .from('vtutor_ucat_question_sets')
          .select('id, sections')
          .in('id', setIds)
      : { data: [] }

  type SetDetailRow = { id: string | null; sections: unknown }
  const setDetailsList = (setDetails ?? []) as SetDetailRow[]
  const setSectionBySetId = new Map<string, string>()
  for (const s of setDetailsList) {
    if (!s.id) continue
    const sectionsArr = s.sections as Array<{ section_number?: number }> | null
    const firstNum =
      Array.isArray(sectionsArr) && sectionsArr.length > 0
        ? sectionsArr[0]?.section_number
        : undefined
    if (firstNum != null) {
      const secId = sectionByNumber.get(firstNum)
      if (secId) setSectionBySetId.set(s.id, secId)
    }
  }

  const { data: mockAttemptsRaw } = await supabase
    .from('vtutor_ucat_student_mock_attempts')
    .select('student_id, attempted_at, completed_at, scaled_score')
    .in('student_id', studentIds)
    .not('completed_at', 'is', null)

  type QARow = { student_id: string | null; attempted_at: string | null }
  type SetRow = {
    student_id: string | null
    attempted_at: string | null
    completed_at: string | null
    scaled_score: number | null
    set_id: string | null
  }
  type MockRow = {
    student_id: string | null
    attempted_at: string | null
    completed_at: string | null
    scaled_score: number | null
  }

  const byStudent = new Map<
    string,
    {
      questions: number
      sets: Set<string>
      mocks: number
      examScores: { date: string; score: number }[]
      lastAttempted: string | null
      sectionScores: Map<string, { date: string; score: number }[]>
    }
  >()

  for (const s of students) {
    const id = s.student_id
    if (!id) continue
    byStudent.set(id, {
      questions: 0,
      sets: new Set(),
      mocks: 0,
      examScores: [],
      lastAttempted: null,
      sectionScores: new Map(
        sectionList.map((sec) => [sec.id!, []])
      ),
    })
  }

  const qaList = (qaRaw ?? []) as QARow[]
  for (const qa of qaList) {
    const sid = qa.student_id
    if (!sid) continue
    const entry = byStudent.get(sid)
    if (!entry) continue
    const use = countsUseTimeFilter ? filterByTime(qa.attempted_at) : true
    if (use) entry.questions += 1
    if (qa.attempted_at) {
      const current = entry.lastAttempted
      if (!current || qa.attempted_at > current) {
        entry.lastAttempted = qa.attempted_at
      }
    }
  }

  for (const row of (setAttemptsRaw ?? []) as SetRow[]) {
    const sid = row.student_id
    if (!sid) continue
    const entry = byStudent.get(sid)
    if (!entry) continue
    const dateStr = row.completed_at ?? row.attempted_at ?? ''
    const use = countsUseTimeFilter ? filterByTime(dateStr) : true
    if (use) {
      entry.sets.add(row.set_id ?? '')
      const sectionId = row.set_id ? setSectionBySetId.get(row.set_id) : null
      if (sectionId && row.scaled_score != null) {
        const arr = entry.sectionScores.get(sectionId)
        if (arr) arr.push({ date: dateStr, score: row.scaled_score })
      }
    }
    if (dateStr && (!entry.lastAttempted || dateStr > entry.lastAttempted)) {
      entry.lastAttempted = dateStr
    }
  }

  for (const row of (mockAttemptsRaw ?? []) as MockRow[]) {
    const sid = row.student_id
    if (!sid) continue
    const entry = byStudent.get(sid)
    if (!entry) continue
    const dateStr = row.completed_at ?? row.attempted_at ?? ''
    const use = countsUseTimeFilter ? filterByTime(dateStr) : true
    if (use) {
      entry.mocks += 1
      if (row.scaled_score != null && row.scaled_score > 0) {
        entry.examScores.push({ date: dateStr, score: row.scaled_score })
      }
    }
    if (dateStr && (!entry.lastAttempted || dateStr > entry.lastAttempted)) {
      entry.lastAttempted = dateStr
    }
  }

  const sectionsMeta = sectionList.map((s) => ({
    id: s.id,
    name: s.name ?? 'Unknown',
    section_number: s.section_number ?? 0,
  }))

  const result = {
    students: students
    .filter((s) => s.student_id)
    .map((s) => {
      const id = s.student_id!
      const entry = byStudent.get(id)
      if (!entry) {
        return {
          student_id: id,
          student_name: s.student_name ?? '-',
          total_questions: 0,
          total_sets_attempted: 0,
          total_mocks_attempted: 0,
          exam: null,
          last_attempted_at: null,
          section_scores: Object.fromEntries(
            sectionList.map((sec) => [sec.id!, null])
          ) as Record<string, number | null>,
        }
      }

      const examScoresByDate = [...entry.examScores].sort((a, b) =>
        a.date.localeCompare(b.date)
      )
      const examScoresOrdered = examScoresByDate.map((x) => x.score)
      const exam =
        mode === 'weighted' && examScoresOrdered.length > 0
          ? computeEma(examScoresOrdered)
          : examScoresOrdered.length > 0
            ? examScoresOrdered.reduce((a, b) => a + b, 0) / examScoresOrdered.length
            : null

      const sectionScores: Record<string, number | null> = {}
      for (const [sectionId, items] of entry.sectionScores) {
        if (items.length === 0) {
          sectionScores[sectionId] = null
        } else if (mode === 'weighted') {
          const ordered = [...items]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((x) => x.score)
          sectionScores[sectionId] = computeEma(ordered)
        } else {
          const avg =
            items.reduce((a, b) => a + b.score, 0) / items.length
          sectionScores[sectionId] = Math.round(avg * 10) / 10
        }
      }

      return {
        student_id: id,
        student_name: s.student_name ?? '-',
        total_questions: entry.questions,
        total_sets_attempted: entry.sets.size,
        total_mocks_attempted: entry.mocks,
        exam: exam != null ? Math.round(exam) : null,
        last_attempted_at: entry.lastAttempted,
        section_scores: sectionScores,
      }
    })
    .sort((a, b) => (b.last_attempted_at ?? '').localeCompare(a.last_attempted_at ?? '')),
    sections: sectionsMeta,
  }

  return NextResponse.json(result)
}
