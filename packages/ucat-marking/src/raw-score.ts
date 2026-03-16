import {
  SITUATIONAL_JUDGEMENT_SECTION_NAME,
  SJT_OPTION_COUNT,
  SYLLOGISM_POINTS,
} from './config'
import type { Attempt, QuestionMeta, RawScoreResult } from './types'

/**
 * Compute raw score for a set of question attempts using UCAT marking rules:
 * - Syllogism: group by stem, 5 correct=2, 3-4=1, 0-2=0
 * - Situational Judgement (4 options): A/B same polarity, C/D same polarity; correct=1, same polarity=0.5
 * - Default: 1 for correct, 0 for wrong
 */
export function computeRawScore(params: {
  attempts: Attempt[]
  questions: QuestionMeta[]
}): RawScoreResult {
  const { attempts, questions } = params
  const attemptByQuestion = new Map(attempts.map((a) => [a.questionId, a]))
  const questionScores = new Map<string, number>()

  // Syllogism: group by stem_id, compute stem-level score, then distribute to questions
  const syllogismStems = new Map<string, QuestionMeta[]>()
  for (const q of questions) {
    if (q.questionType === 'syllogism') {
      const list = syllogismStems.get(q.stemId) ?? []
      list.push(q)
      syllogismStems.set(q.stemId, list)
    }
  }

  // Process syllogism stems
  // correctCount: count of correct answers across ALL questions in stem (unattempted = wrong)
  for (const [, stemQuestions] of syllogismStems) {
    const correctCount = stemQuestions.filter(
      (q) => attemptByQuestion.get(q.id)?.selectedOptionId === q.correctOptionId
    ).length
    const stemPoints = SYLLOGISM_POINTS[correctCount] ?? 0

    // Distribute stem points across correct questions only (so total = stemPoints)
    const pointsPerCorrect =
      correctCount > 0 ? stemPoints / correctCount : 0
    for (const q of stemQuestions) {
      const attempt = attemptByQuestion.get(q.id)
      const isCorrect = attempt?.selectedOptionId === q.correctOptionId
      questionScores.set(q.id, isCorrect ? pointsPerCorrect : 0)
    }
  }

  // Process non-syllogism questions (including SJT)
  for (const q of questions) {
    if (questionScores.has(q.id)) continue // already handled (syllogism)

    const attempt = attemptByQuestion.get(q.id)
    if (!attempt) {
      questionScores.set(q.id, 0)
      continue
    }

    const isCorrect = attempt.selectedOptionId === q.correctOptionId
    if (isCorrect) {
      questionScores.set(q.id, 1)
      continue
    }

    // SJT: same polarity (A↔B or C↔D) = 0.5
    if (
      q.sectionName === SITUATIONAL_JUDGEMENT_SECTION_NAME &&
      q.options.length === SJT_OPTION_COUNT
    ) {
      const selectedIdx = q.options.findIndex(
        (o) => o.id === attempt.selectedOptionId
      )
      const correctIdx = q.options.findIndex((o) => o.id === q.correctOptionId)
      if (selectedIdx >= 0 && correctIdx >= 0) {
        const selectedGroup = selectedIdx < 2 ? 'AB' : 'CD'
        const correctGroup = correctIdx < 2 ? 'AB' : 'CD'
        if (selectedGroup === correctGroup) {
          questionScores.set(q.id, 0.5)
          continue
        }
      }
    }

    questionScores.set(q.id, 0)
  }

  const totalRawScore = Array.from(questionScores.values()).reduce(
    (sum, s) => sum + s,
    0
  )

  return { questionScores, totalRawScore }
}

/**
 * Compute the maximum possible raw score for a set of questions.
 * Used for scaling: syllogism stems contribute 2 max, SJT/default contribute 1 each.
 */
export function computeMaxRawScore(questions: QuestionMeta[]): number {
  const syllogismStemIds = new Set<string>()
  let max = 0
  for (const q of questions) {
    if (q.questionType === 'syllogism') {
      if (!syllogismStemIds.has(q.stemId)) {
        syllogismStemIds.add(q.stemId)
        max += 2
      }
    } else {
      max += 1
    }
  }
  return max
}
