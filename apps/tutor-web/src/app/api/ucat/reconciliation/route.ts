import { NextResponse } from 'next/server'
import { requireUcatTutor } from '@/features/ucat/shared/server/guard'
import {
  getSetSectionStatus,
  parseSetSections,
  formatSetSectionsDisplay,
  isMockSetOrderCorrect,
} from '@/features/ucat/shared/lib/set-section-status'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatSectionForStatus } from '@/features/ucat/shared/lib/set-section-status'

function hasExplanation(value: unknown): boolean {
  if (value == null) return false
  if (typeof value !== 'object') return false
  const rec = value as Record<string, unknown>
  const content = rec.content
  if (!Array.isArray(content)) return false
  const text = content
    .flatMap((node) => {
      if (!node || typeof node !== 'object') return []
      const n = node as Record<string, unknown>
      const c = n.content
      if (!Array.isArray(c)) return []
      return c.map((child) => (child && typeof child === 'object' && 'text' in child ? String((child as { text?: string }).text ?? '') : '')).join('')
    })
    .join('')
  return text.trim().length > 0
}

type QuestionRow = {
  id: string
  question_text: unknown
  answer_explanation: unknown
  index: number
  deleted_at?: string | null
  answer_options?: Array<{ answer_explanation: unknown; deleted_at?: string | null }>
}

function questionLacksExplanation(q: QuestionRow): boolean {
  if (q.deleted_at) return false

  const hasQuestionExplanation = hasExplanation(q.answer_explanation)
  if (hasQuestionExplanation) return false

  const options = (q.answer_options ?? []).filter((opt) => !opt.deleted_at)
  if (options.length === 0) return true
  const allOptionsHaveExplanation = options.every((opt) => hasExplanation(opt.answer_explanation))
  return !allOptionsHaveExplanation
}

type StemDetailRow = {
  id: string
  section_id: string
  section_name: string
  stem_text: unknown
  question_stem_category_id: string | null
  deleted_at: string | null
  questions: QuestionRow[]
}

export async function GET() {
  const access = await requireUcatTutor()
  if (!access.ok) return access.response

  const { data: stems, error } = await access.userClient
    .from('vtutor_ucat_question_stem_detail')
    .select('id,section_id,section_name,stem_text,question_stem_category_id,category_name,deleted_at,questions')
    .is('deleted_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (stems ?? []) as StemDetailRow[]

  const { data: stemsList, error: stemsListError } = await access.userClient
    .from('vtutor_ucat_question_stems')
    .select('id,is_private,set_names')
    .is('deleted_at', null)

  if (stemsListError) return NextResponse.json({ error: stemsListError.message }, { status: 500 })

  const privateStemIdsNotInSet = new Set<string>()
  for (const s of stemsList ?? []) {
    const row = s as { id: string; is_private: boolean; set_names: unknown }
    if (!row.is_private) continue
    const setNames = row.set_names
    const isEmpty = setNames == null || (Array.isArray(setNames) && setNames.length === 0)
    if (isEmpty) privateStemIdsNotInSet.add(row.id)
  }

  const stemsWithNoCategory = rows
    .filter((r) => !r.question_stem_category_id)
    .map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name ?? '',
      stemText: r.stem_text,
      questions: (r.questions ?? []) as QuestionRow[],
    }))

  const questionsWithNoExplanation: Array<{
    stemId: string
    stemText: unknown
    sectionId: string
    sectionName: string
    questionId: string
    questionText: unknown
    questionIndex: number
  }> = []

  for (const stem of rows) {
    const questions = (stem.questions ?? []) as QuestionRow[]
    for (const q of questions) {
      if (questionLacksExplanation(q)) {
        questionsWithNoExplanation.push({
          stemId: stem.id,
          stemText: stem.stem_text,
          sectionId: stem.section_id,
          sectionName: stem.section_name ?? '',
          questionId: q.id,
          questionText: q.question_text,
          questionIndex: q.index,
        })
      }
    }
  }

  type StemDetailWithCategory = StemDetailRow & { category_name?: string | null }
  const privateStemsNotInSet = rows
    .filter((r) => privateStemIdsNotInSet.has(r.id))
    .map((r) => ({
      id: r.id,
      sectionId: r.section_id,
      sectionName: r.section_name ?? '',
      categoryName: (r as StemDetailWithCategory).category_name ?? null,
      stemText: r.stem_text,
      questions: (r.questions ?? []) as QuestionRow[],
    }))

  // Fetch sections for set/mock status computation
  const { data: sectionsData, error: sectionsError } = await access.userClient
    .from('vtutor_ucat_sections')
    .select('id,section_number,name,number_of_questions,time_limit_seconds')

  if (sectionsError) return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  const sections: UcatSectionForStatus[] = (sectionsData ?? []).map((s) => {
    const row = s as { id?: string; section_number?: number; name?: unknown; number_of_questions?: number; time_limit_seconds?: number }
    const nameVal = row.name
    const nameStr: string | null = nameVal == null ? null : typeof nameVal === 'string' ? nameVal : (proseMirrorToPlainText(nameVal as import('@altitutor/shared').Json) ?? null)
    return {
      id: row.id ?? null,
      section_number: row.section_number ?? null,
      name: nameStr ?? null,
      number_of_questions: row.number_of_questions ?? null,
      time_limit_seconds: row.time_limit_seconds ?? null,
    }
  })

  // Fetch sets: exclude deleted and student-generated
  const { data: setsData, error: setsError } = await access.userClient
    .from('vtutor_ucat_question_sets')
    .select('id,name,sections,stem_count,question_count,time_limit_seconds')
    .is('deleted_at', null)
    .eq('is_student_generated', false)

  if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 })
  const allSets = (setsData ?? []) as Array<{
    id: string
    name: unknown
    sections: unknown
    stem_count: number
    question_count: number
    time_limit_seconds: number | null
  }>

  type SetReconciliationRow = {
    id: string
    name: string
    sectionDisplay: string
    stemCount: number
    questionCount: number
    timeLimitSeconds: number | null
    sectionCount: number
    firstSectionNumber: number | null
    questionCountStatus: 'match' | 'mismatch'
    questionCountTooltip: string
    timeLimitStatus: 'match' | 'partial' | 'mismatch' | 'untimed'
    timeLimitTooltip: string
  }

  const setRows: SetReconciliationRow[] = allSets.map((s) => {
    const parsed = parseSetSections(s.sections ?? null)
    const status = getSetSectionStatus(
      {
        sectionCount: parsed.sectionCount,
        firstSectionNumber: parsed.firstSectionNumber,
        question_count: s.question_count ?? null,
        time_limit_seconds: s.time_limit_seconds ?? null,
      },
      sections
    )
    const nameStr = proseMirrorToPlainText(s.name as import('@altitutor/shared').Json)?.trim() || 'Untitled'
    return {
      id: s.id,
      name: nameStr,
      sectionDisplay: formatSetSectionsDisplay(s.sections ?? null),
      stemCount: s.stem_count ?? 0,
      questionCount: s.question_count ?? 0,
      timeLimitSeconds: s.time_limit_seconds ?? null,
      sectionCount: parsed.sectionCount,
      firstSectionNumber: parsed.firstSectionNumber,
      questionCountStatus: status.questionCountStatus,
      questionCountTooltip: status.questionCountTooltip,
      timeLimitStatus: status.timeLimitStatus,
      timeLimitTooltip: status.timeLimitTooltip,
    }
  })

  const setsWithIncorrectQuestionCount = setRows.filter(
    (r) => r.sectionCount === 1 && r.questionCountStatus === 'mismatch'
  )
  const setsWithIncorrectTiming = setRows.filter((r) => {
    if (r.timeLimitStatus === 'untimed') return false
    if (r.timeLimitStatus === 'match' && r.questionCountStatus === 'mismatch') return false
    return r.timeLimitStatus === 'partial' || r.timeLimitStatus === 'mismatch'
  })
  const setsWithMultipleSections = setRows.filter((r) => r.sectionCount > 1)

  // Fetch mocks: exclude deleted
  const { data: mocksData, error: mocksError } = await access.userClient
    .from('vtutor_ucat_mocks')
    .select('id,name,set_count')
    .is('deleted_at', null)

  if (mocksError) return NextResponse.json({ error: mocksError.message }, { status: 500 })
  const mocksList = (mocksData ?? []) as Array<{ id: string; name: unknown; set_count: number }>

  const mocksWithIncorrectSets: Array<{ id: string; name: string; setCount: number; sets: Array<{ id: string; name: string }> }> = []
  for (const mock of mocksList) {
    const { data: mockDetail } = await access.userClient
      .from('vtutor_ucat_mock_detail')
      .select('sets')
      .eq('id', mock.id)
      .maybeSingle()

    const sets = (mockDetail as { sets?: Array<{ id: string; name?: unknown; sections?: unknown }> } | null)?.sets ?? []
    const correct = isMockSetOrderCorrect(mock.set_count ?? 0, sets, sections)
    if (!correct) {
      const mockNameStr = proseMirrorToPlainText(mock.name as import('@altitutor/shared').Json)?.trim() || 'Untitled'
      const setsDisplay = sets.map((st) => ({
        id: st.id,
        name: proseMirrorToPlainText(st.name as import('@altitutor/shared').Json)?.trim() || 'Untitled',
      }))
      mocksWithIncorrectSets.push({
        id: mock.id,
        name: mockNameStr,
        setCount: mock.set_count ?? 0,
        sets: setsDisplay,
      })
    }
  }

  return NextResponse.json({
    stemsWithNoCategory,
    questionsWithNoExplanation,
    privateStemsNotInSet,
    setsWithIncorrectQuestionCount,
    setsWithIncorrectTiming,
    setsWithMultipleSections,
    mocksWithIncorrectSets,
  })
}
