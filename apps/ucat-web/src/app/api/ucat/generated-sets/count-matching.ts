import type { SupabaseClient } from '@supabase/supabase-js'
import type { SetGeneratorInput } from '@/features/set-generator/model/types'

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

const SECTION_KEY_TO_NUMBER: Record<string, number> = {
  verbal_reasoning: 1,
  decision_making: 2,
  quantitative_reasoning: 3,
  situational_judgement: 4,
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

/**
 * Computes the total number of questions matching the given filters.
 * Used by both the preview endpoint and the generate endpoint.
 */
export async function countMatchingQuestions(
  supabase: SupabaseClient,
  input: SetGeneratorInput
): Promise<{ totalMatchingQuestions: number }> {
  const sectionNumber = SECTION_KEY_TO_NUMBER[input.section]
  if (typeof sectionNumber !== 'number') {
    return { totalMatchingQuestions: 0 }
  }

  const sectionNumbers = [sectionNumber]

  const { data: sections, error: sectionsError } = await supabase
    .from('vstudent_ucat_sections')
    .select('id,section_number,time_per_question,number_of_questions')
    .in('section_number', sectionNumbers)

  if (sectionsError || !sections?.length) {
    return { totalMatchingQuestions: 0 }
  }

  const sectionRows = sections as SectionRow[]
  const sectionIds = sectionRows.map((row) => row.id)

  let stemsQuery = supabase
    .from('vstudent_ucat_question_stems')
    .select('id,section_id,question_stem_category_id')
    .in('section_id', sectionIds)

  if (input.categoryIds && input.categoryIds.length > 0) {
    stemsQuery = stemsQuery.in('question_stem_category_id', input.categoryIds)
  }

  const { data: stems, error: stemsError } = await stemsQuery

  if (stemsError || !stems?.length) {
    return { totalMatchingQuestions: 0 }
  }

  const stemRows = stems as StemListRow[]
  const stemIds = stemRows.map((row) => row.id)

  const { data: stemDetails, error: stemDetailsError } = await supabase
    .from('vstudent_ucat_question_stem_detail')
    .select('id,section_id,questions')
    .in('id', stemIds)

  if (stemDetailsError || !stemDetails?.length) {
    return { totalMatchingQuestions: 0 }
  }

  const stemDetailRows = stemDetails as StemDetailRow[]

  const allQuestions: { stemId: string; question: StemDetailQuestion }[] = []
  for (const stem of stemDetailRows) {
    for (const q of stem.questions ?? []) {
      allQuestions.push({ stemId: stem.id, question: q })
    }
  }

  if (allQuestions.length === 0) {
    return { totalMatchingQuestions: 0 }
  }

  let attemptsByQuestionId = new Map<string, QuestionAttemptRow[]>()

  if (input.unansweredOnly || input.incorrectOnly) {
    const questionIds = Array.from(new Set(allQuestions.map((q) => q.question.id)))

    const { data: attempts, error: attemptsError } = await supabase
      .from('vstudent_ucat_my_question_attempts')
      .select('question_id,score,is_submitted')
      .in('question_id', questionIds)

    if (!attemptsError && attempts) {
      const attemptRows = attempts as QuestionAttemptRow[]
      attemptsByQuestionId = attemptRows.reduce((map, row) => {
        const existing = map.get(row.question_id) ?? []
        existing.push(row)
        map.set(row.question_id, existing)
        return map
      }, new Map<string, QuestionAttemptRow[]>())
    }
  }

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

  const totalMatchingQuestions = candidateStems.reduce(
    (sum, agg) => sum + agg.matchingQuestionsCount,
    0
  )

  return { totalMatchingQuestions }
}
