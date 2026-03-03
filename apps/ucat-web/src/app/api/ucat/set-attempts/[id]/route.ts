import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  computeMaxRawScore,
  computeRawScore,
  scaleTo300_900,
} from '@altitutor/ucat-marking'
import type { QuestionMeta } from '@altitutor/ucat-marking'

type QuestionRow = {
  id: string
  question_stem_id: string
  question_type: 'multiple_choice' | 'syllogism'
}

type OptionRow = {
  id: string
  question_id: string
  index: number
  is_answer: boolean
}

function buildQuestionMeta(
  questions: QuestionRow[],
  sectionByNameStemId: Map<string, string>,
  optionsByQuestionId: Map<string, OptionRow[]>
): QuestionMeta[] {
  return questions.map((q) => {
    const sectionName =
      sectionByNameStemId.get(q.question_stem_id) ?? 'Unknown'
    const options = (optionsByQuestionId.get(q.id) ?? [])
      .sort((a, b) => a.index - b.index)
      .map((o) => ({ id: o.id, index: o.index }))
    const correctOption = (optionsByQuestionId.get(q.id) ?? []).find(
      (o) => o.is_answer
    )
    return {
      id: q.id,
      stemId: q.question_stem_id,
      sectionName,
      questionType: q.question_type,
      correctOptionId: correctOption?.id ?? '',
      options,
    }
  })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const body = (await request.json()) as { complete?: boolean }

  if (!body.complete) {
    return NextResponse.json({ error: 'Unsupported operation' }, { status: 400 })
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server write client not configured' }, { status: 500 })
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (studentError) {
    return NextResponse.json({ error: 'Failed to resolve student' }, { status: 500 })
  }

  if (!student) {
    return NextResponse.json({ error: 'No student profile found' }, { status: 404 })
  }

  const attemptId = params.id

  const { data: attempt, error: attemptError } = await supabaseAdmin
    .from('student_question_set_attempts')
    .select('attempted_at, question_set_id')
    .eq('id', attemptId)
    .eq('student_id', student.id)
    .maybeSingle()

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 })
  }

  if (!attempt) {
    return NextResponse.json({ error: 'Set attempt not found' }, { status: 404 })
  }

  const attemptedAt = new Date(attempt.attempted_at)
  const now = new Date()
  const timeTakenSeconds = Math.max(
    0,
    Math.floor((now.getTime() - attemptedAt.getTime()) / 1000)
  )

  const { data: questionAttempts, error: questionAttemptsError } = await supabaseAdmin
    .from('student_question_attempts')
    .select('id, question_id, question_answer_option_id, student_id')
    .eq('student_question_set_attempt_id', attemptId)
    .eq('student_id', student.id)

  if (questionAttemptsError) {
    return NextResponse.json({ error: questionAttemptsError.message }, { status: 500 })
  }

  let totalQuestions = 0
  let rawScore = 0
  let scaledScore: number | null = null

  if (questionAttempts && questionAttempts.length > 0) {
    totalQuestions = questionAttempts.length
    const questionIds = questionAttempts.map((qa) => qa.question_id)

    const { data: questions, error: questionsError } = await supabaseAdmin
      .from('ucat_questions')
      .select('id, question_stem_id, question_type')
      .in('id', questionIds)

    if (questionsError) {
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    const stemIds = [...new Set((questions ?? []).map((q) => q.question_stem_id))]

    const { data: stems, error: stemsError } = await supabaseAdmin
      .from('question_stems')
      .select('id, section_id')
      .in('id', stemIds)

    if (stemsError) {
      return NextResponse.json({ error: stemsError.message }, { status: 500 })
    }

    const sectionIds = [...new Set((stems ?? []).map((s) => s.section_id))]

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from('ucat_sections')
      .select('id, name')
      .in('id', sectionIds)

    if (sectionsError) {
      return NextResponse.json({ error: sectionsError.message }, { status: 500 })
    }

    const sectionById = new Map(
      (sections ?? []).map((s) => [s.id, s.name])
    )
    const sectionByNameStemId = new Map(
      (stems ?? []).map((s) => [s.id, sectionById.get(s.section_id) ?? ''])
    )

    const { data: options, error: optionsError } = await supabaseAdmin
      .from('question_answer_options')
      .select('id, question_id, index, is_answer')
      .in('question_id', questionIds)

    if (optionsError) {
      return NextResponse.json({ error: optionsError.message }, { status: 500 })
    }

    const optionsByQuestionId = new Map<string, OptionRow[]>()
    for (const opt of options ?? []) {
      const list = optionsByQuestionId.get(opt.question_id) ?? []
      list.push(opt)
      optionsByQuestionId.set(opt.question_id, list)
    }

    const questionMeta = buildQuestionMeta(
      questions ?? [],
      sectionByNameStemId,
      optionsByQuestionId
    )

    const attempts = (questionAttempts ?? [])
      .filter((qa) => qa.question_answer_option_id != null)
      .map((qa) => ({
        questionId: qa.question_id,
        selectedOptionId: qa.question_answer_option_id as string,
      }))

    const { questionScores, totalRawScore } = computeRawScore({
      attempts,
      questions: questionMeta,
    })

    rawScore = totalRawScore

    const maxRawScore = computeMaxRawScore(questionMeta)
    if (maxRawScore > 0) {
      scaledScore = scaleTo300_900(rawScore, maxRawScore)
    }

    const updates = questionAttempts.map((qa) => ({
      id: qa.id,
      question_id: qa.question_id,
      student_id: qa.student_id,
      score: questionScores.get(qa.question_id) ?? 0,
      is_submitted: true,
    }))

    if (updates.length > 0) {
      const { error: updateQuestionsError } = await supabaseAdmin
        .from('student_question_attempts')
        .upsert(updates, { onConflict: 'id' })

      if (updateQuestionsError) {
        return NextResponse.json({ error: updateQuestionsError.message }, { status: 500 })
      }
    }
  }

  const { error: updateSetError } = await supabaseAdmin
    .from('student_question_set_attempts')
    .update({
      time_taken_seconds: timeTakenSeconds,
      completed_at: now.toISOString(),
      score_points: totalQuestions === 0 ? null : rawScore,
      total_points: totalQuestions === 0 ? null : totalQuestions,
      scaled_score: scaledScore,
    })
    .eq('id', attemptId)
    .eq('student_id', student.id)

  if (updateSetError) {
    return NextResponse.json({ error: updateSetError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
