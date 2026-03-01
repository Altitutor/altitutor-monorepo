import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sectionLabels } from '@/features/set-generator/model/mock-data'
import type { SetGeneratorInput, TimeMode } from '@/features/set-generator/model/types'

type SectionRow = {
  id: string
  section_number: number
  time_per_question: number | null
  number_of_questions: number | null
}

type StemListRow = {
  id: string
  section_id: string
  question_stem_category_id: string | null
}

type StemDetailQuestion = {
  id: string
}

type StemDetailRow = {
  id: string
  section_id: string
  questions: StemDetailQuestion[] | null
}

type QuestionAttemptRow = {
  question_id: string
  score: number | null
  is_submitted: boolean
}

type GeneratorResponse = {
  setId: string
  questionCount: number
  totalMatchingQuestions: number
  examTimeSeconds: number | null
}

const SECTION_KEY_TO_NUMBER: Record<string, number> = {
  verbal_reasoning: 1,
  decision_making: 2,
  quantitative_reasoning: 3,
  situational_judgement: 4,
}

function resolveEffectiveQuestionCount(
  requested: number,
  sections: SectionRow[],
  availableQuestions: number
): number {
  const maxBySections = sections.reduce((sum, section) => {
    return sum + (section.number_of_questions ?? 0)
  }, 0)

  const hardCap = maxBySections > 0 ? maxBySections : availableQuestions
  const clampedRequested = Math.max(1, Math.floor(requested))

  return Math.min(clampedRequested, hardCap, availableQuestions)
}

function computeQuestionStatus(attempts: QuestionAttemptRow[] | undefined) {
  if (!attempts || attempts.length === 0) {
    return 'unanswered' as const
  }

  const submitted = attempts.filter((row) => row.is_submitted)
  if (submitted.length === 0) {
    return 'unanswered' as const
  }

  const anyCorrect = submitted.some((row) => (row.score ?? 0) > 0)
  return anyCorrect ? ('correct' as const) : ('incorrect' as const)
}

function computeTimeLimitSeconds(
  mode: TimeMode,
  customTimeMinutes: number | null,
  chosenStems: StemDetailRow[],
  sectionsById: Map<string, SectionRow>
): number | null {
  if (mode === 'off') {
    return null
  }

  if (mode === 'custom') {
    if (customTimeMinutes == null || !Number.isFinite(customTimeMinutes) || customTimeMinutes <= 0) {
      return null
    }
    return Math.round(customTimeMinutes * 60)
  }

  // Exam mode: sum (questions in section) * (section time_per_question)
  const sectionQuestionCounts = new Map<string, number>()

  for (const stem of chosenStems) {
    const sectionId = stem.section_id
    const increment = (stem.questions ?? []).length
    if (increment === 0) continue

    const current = sectionQuestionCounts.get(sectionId) ?? 0
    sectionQuestionCounts.set(sectionId, current + increment)
  }

  let totalSeconds = 0

  for (const [sectionId, count] of sectionQuestionCounts.entries()) {
    const section = sectionsById.get(sectionId)
    if (!section || section.time_per_question == null || section.time_per_question <= 0) {
      continue
    }
    totalSeconds += count * section.time_per_question
  }

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null
  }

  return Math.round(totalSeconds)
}

function buildRichText(text: string) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  }
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase admin client is not configured on this environment.' },
      { status: 500 }
    )
  }

  const supabase = await getSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { input?: SetGeneratorInput }
  try {
    body = (await request.json()) as { input?: SetGeneratorInput }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input = body.input

  if (!input?.section) {
    return NextResponse.json({ error: 'A section must be selected.' }, { status: 400 })
  }

  const sectionNumber = SECTION_KEY_TO_NUMBER[input.section]
  if (typeof sectionNumber !== 'number') {
    return NextResponse.json({ error: 'Invalid section selection.' }, { status: 400 })
  }

  const sectionNumbers = [sectionNumber]

  // 1) Load section timing metadata (student-safe view)
  const { data: sections, error: sectionsError } = await supabase
    .from('vstudent_ucat_sections')
    .select('id,section_number,time_per_question,number_of_questions')
    .in('section_number', sectionNumbers)

  if (sectionsError) {
    return NextResponse.json({ error: sectionsError.message }, { status: 500 })
  }

  const sectionRows = (sections ?? []) as SectionRow[]
  if (sectionRows.length === 0) {
    return NextResponse.json({ error: 'No UCAT sections available for these filters.' }, { status: 400 })
  }

  const sectionIds = sectionRows.map((row) => row.id)
  const sectionsById = new Map<string, SectionRow>(sectionRows.map((row) => [row.id, row]))

  // 2) Load stems in those sections, optionally filtered by category
  let stemsQuery = supabase
    .from('vstudent_ucat_question_stems')
    .select('id,section_id,question_stem_category_id')
    .in('section_id', sectionIds)

  if (input.categoryIds && input.categoryIds.length > 0) {
    stemsQuery = stemsQuery.in('question_stem_category_id', input.categoryIds)
  }

  const { data: stems, error: stemsError } = await stemsQuery

  if (stemsError) {
    return NextResponse.json({ error: stemsError.message }, { status: 500 })
  }

  const stemRows = (stems ?? []) as StemListRow[]
  if (stemRows.length === 0) {
    return NextResponse.json(
      { error: 'No question stems found for these filters.', details: { totalMatchingQuestions: 0 } },
      { status: 400 }
    )
  }

  const stemIds = stemRows.map((row) => row.id)

  // 3) Load stem details (questions per stem)
  const { data: stemDetails, error: stemDetailsError } = await supabase
    .from('vstudent_ucat_question_stem_detail')
    .select('id,section_id,questions')
    .in('id', stemIds)

  if (stemDetailsError) {
    return NextResponse.json({ error: stemDetailsError.message }, { status: 500 })
  }

  const stemDetailRows = (stemDetails ?? []) as StemDetailRow[]

  // Collect all question IDs first
  const allQuestions: { stemId: string; question: StemDetailQuestion }[] = []
  for (const stem of stemDetailRows) {
    for (const q of stem.questions ?? []) {
      allQuestions.push({ stemId: stem.id, question: q })
    }
  }

  if (allQuestions.length === 0) {
    return NextResponse.json(
      { error: 'No questions available for these filters.', details: { totalMatchingQuestions: 0 } },
      { status: 400 }
    )
  }

  // 4) Load student attempts only if performance filters are enabled
  let attemptsByQuestionId = new Map<string, QuestionAttemptRow[]>()

  if (input.unansweredOnly || input.incorrectOnly) {
    const questionIds = Array.from(new Set(allQuestions.map((q) => q.question.id)))

    const { data: attempts, error: attemptsError } = await supabase
      .from('vstudent_ucat_my_question_attempts')
      .select('question_id,score,is_submitted')
      .in('question_id', questionIds)

    if (attemptsError) {
      return NextResponse.json({ error: attemptsError.message }, { status: 500 })
    }

    const attemptRows = (attempts ?? []) as QuestionAttemptRow[]
    attemptsByQuestionId = attemptRows.reduce((map, row) => {
      const existing = map.get(row.question_id) ?? []
      existing.push(row)
      map.set(row.question_id, existing)
      return map
    }, new Map<string, QuestionAttemptRow[]>())
  }

  // 5) Apply filters at question level (performance only; no difficulty filter), then aggregate per stem
  type StemAggregate = {
    stem: StemDetailRow
    allQuestionsCount: number
    matchingQuestionsCount: number
  }

  const aggregatesByStemId = new Map<string, StemAggregate>()

  for (const stem of stemDetailRows) {
    const questions = stem.questions ?? []
    let allCount = 0
    let matchingCount = 0

    for (const q of questions) {
      allCount += 1

      let performanceOk = true
      if (input.unansweredOnly || input.incorrectOnly) {
        const status = computeQuestionStatus(attemptsByQuestionId.get(q.id))
        if (input.unansweredOnly) {
          performanceOk = status === 'unanswered'
        } else if (input.incorrectOnly) {
          performanceOk = status === 'incorrect'
        }
      }

      if (performanceOk) {
        matchingCount += 1
      }
    }

    aggregatesByStemId.set(stem.id, {
      stem,
      allQuestionsCount: allCount,
      matchingQuestionsCount: matchingCount,
    })
  }

  const candidateStems: StemAggregate[] = Array.from(aggregatesByStemId.values()).filter(
    (agg) => agg.matchingQuestionsCount > 0 && agg.allQuestionsCount > 0
  )

  if (candidateStems.length === 0) {
    return NextResponse.json(
      { error: 'No questions match these filters.', details: { totalMatchingQuestions: 0 } },
      { status: 400 }
    )
  }

  const totalMatchingQuestions = candidateStems.reduce((sum, agg) => sum + agg.matchingQuestionsCount, 0)
  const availableQuestions = candidateStems.reduce((sum, agg) => sum + agg.allQuestionsCount, 0)

  const targetQuestionCount = resolveEffectiveQuestionCount(input.questionCount, sectionRows, availableQuestions)

  // 6) Pick stems until total questions <= targetQuestionCount
  const chosenStems: StemDetailRow[] = []
  let runningQuestions = 0

  // Deterministic ordering: by stem id
  candidateStems.sort((a, b) => a.stem.id.localeCompare(b.stem.id))

  for (const agg of candidateStems) {
    if (runningQuestions + agg.allQuestionsCount > targetQuestionCount) {
      continue
    }
    chosenStems.push(agg.stem)
    runningQuestions += agg.allQuestionsCount
  }

  if (chosenStems.length === 0) {
    // If we couldn't fit even a single stem under the cap, fall back to the smallest stem
    const smallest = candidateStems.reduce((min, current) => {
      if (!min || current.allQuestionsCount < min.allQuestionsCount) return current
      return min
    })
    if (smallest) {
      chosenStems.push(smallest.stem)
      runningQuestions = smallest.allQuestionsCount
    }
  }

  const timeLimitSeconds = computeTimeLimitSeconds(
    input.timeMode,
    input.customTimeMinutes,
    chosenStems,
    sectionsById
  )

  // 7) Persist the generated set using the admin client
  const sectionName = sectionLabels[input.section] ?? input.section
  const title = `Practice set (${sectionName})`
  const description = 'Generated from filters on sections and your past attempts.'

  const { data: insertedSet, error: insertSetError } = await supabaseAdmin
    .from('question_sets')
    .insert({
      name: buildRichText(title),
      description: buildRichText(description),
      time_limit_seconds: timeLimitSeconds,
      is_student_generated: true,
      is_private: false,
    })
    .select('id')
    .maybeSingle()

  if (insertSetError || !insertedSet) {
    return NextResponse.json(
      { error: insertSetError?.message ?? 'Failed to create question set' },
      { status: 500 }
    )
  }

  const setId: string = insertedSet.id

  const stemLinks = chosenStems.map((stem, index) => ({
    question_stem_id: stem.id,
    question_set_id: setId,
    index: index + 1,
  }))

  const { error: linkError } = await supabaseAdmin.from('question_stems_question_sets').insert(stemLinks)

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 })
  }

  const response: GeneratorResponse = {
    setId,
    questionCount: runningQuestions,
    totalMatchingQuestions,
    examTimeSeconds: timeLimitSeconds,
  }

  return NextResponse.json(response)
}

