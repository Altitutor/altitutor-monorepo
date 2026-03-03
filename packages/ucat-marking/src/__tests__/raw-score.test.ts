import {
  computeMaxRawScore,
  computeRawScore,
} from '../raw-score'
import type { Attempt, QuestionMeta } from '../types'

function q(
  id: string,
  stemId: string,
  sectionName: string,
  questionType: 'multiple_choice' | 'syllogism',
  correctOptionId: string,
  optionCount: number
): QuestionMeta {
  const options = Array.from({ length: optionCount }, (_, i) => ({
    id: `${id}-opt-${i}`,
    index: i,
  }))
  return {
    id,
    stemId,
    sectionName,
    questionType,
    correctOptionId,
    options,
  }
}

describe('computeRawScore', () => {
  it('default: 1 for correct, 0 for wrong', () => {
    const questions: QuestionMeta[] = [
      q('q1', 's1', 'Verbal Reasoning', 'multiple_choice', 'q1-opt-0', 4),
    ]
    const { totalRawScore, questionScores } = computeRawScore({
      attempts: [{ questionId: 'q1', selectedOptionId: 'q1-opt-0' }],
      questions,
    })
    expect(totalRawScore).toBe(1)
    expect(questionScores.get('q1')).toBe(1)
  })

  it('default: 0 for wrong answer', () => {
    const questions: QuestionMeta[] = [
      q('q1', 's1', 'Verbal Reasoning', 'multiple_choice', 'q1-opt-0', 4),
    ]
    const { totalRawScore } = computeRawScore({
      attempts: [{ questionId: 'q1', selectedOptionId: 'q1-opt-1' }],
      questions,
    })
    expect(totalRawScore).toBe(0)
  })

  it('syllogism: 5 correct = 2 points', () => {
    const stemId = 'syllo-stem'
    const questions: QuestionMeta[] = [
      q('s1', stemId, 'Decision Making', 'syllogism', 's1-opt-0', 2),
      q('s2', stemId, 'Decision Making', 'syllogism', 's2-opt-0', 2),
      q('s3', stemId, 'Decision Making', 'syllogism', 's3-opt-0', 2),
      q('s4', stemId, 'Decision Making', 'syllogism', 's4-opt-0', 2),
      q('s5', stemId, 'Decision Making', 'syllogism', 's5-opt-0', 2),
    ]
    const attempts: Attempt[] = questions.map((q) => ({
      questionId: q.id,
      selectedOptionId: q.correctOptionId,
    }))
    const { totalRawScore } = computeRawScore({ attempts, questions })
    expect(totalRawScore).toBe(2)
  })

  it('syllogism: 3-4 correct = 1 point', () => {
    const stemId = 'syllo-stem'
    const questions: QuestionMeta[] = [
      q('s1', stemId, 'Decision Making', 'syllogism', 's1-opt-0', 2),
      q('s2', stemId, 'Decision Making', 'syllogism', 's2-opt-0', 2),
      q('s3', stemId, 'Decision Making', 'syllogism', 's3-opt-0', 2),
      q('s4', stemId, 'Decision Making', 'syllogism', 's4-opt-0', 2),
      q('s5', stemId, 'Decision Making', 'syllogism', 's5-opt-0', 2),
    ]
    const attempts: Attempt[] = [
      { questionId: 's1', selectedOptionId: 's1-opt-0' },
      { questionId: 's2', selectedOptionId: 's2-opt-0' },
      { questionId: 's3', selectedOptionId: 's3-opt-0' },
      { questionId: 's4', selectedOptionId: 's4-opt-0' },
      { questionId: 's5', selectedOptionId: 's5-opt-1' },
    ]
    const { totalRawScore } = computeRawScore({ attempts, questions })
    expect(totalRawScore).toBe(1)
  })

  it('syllogism: 0-2 correct = 0 points', () => {
    const stemId = 'syllo-stem'
    const questions: QuestionMeta[] = [
      q('s1', stemId, 'Decision Making', 'syllogism', 's1-opt-0', 2),
      q('s2', stemId, 'Decision Making', 'syllogism', 's2-opt-0', 2),
      q('s3', stemId, 'Decision Making', 'syllogism', 's3-opt-0', 2),
      q('s4', stemId, 'Decision Making', 'syllogism', 's4-opt-0', 2),
      q('s5', stemId, 'Decision Making', 'syllogism', 's5-opt-0', 2),
    ]
    const attempts: Attempt[] = questions.map((q, i) => ({
      questionId: q.id,
      selectedOptionId: i < 3 ? `${q.id}-opt-1` : q.correctOptionId,
    }))
    const { totalRawScore } = computeRawScore({ attempts, questions })
    expect(totalRawScore).toBe(0)
  })

  it('SJT: correct = 1 point', () => {
    const questions: QuestionMeta[] = [
      q('sj1', 'sj-stem', 'Situational Judgement', 'multiple_choice', 'sj1-opt-0', 4),
    ]
    const { totalRawScore } = computeRawScore({
      attempts: [{ questionId: 'sj1', selectedOptionId: 'sj1-opt-0' }],
      questions,
    })
    expect(totalRawScore).toBe(1)
  })

  it('SJT: same polarity (A↔B) = 0.5 points', () => {
    const questions: QuestionMeta[] = [
      q('sj1', 'sj-stem', 'Situational Judgement', 'multiple_choice', 'sj1-opt-1', 4),
    ]
    const { totalRawScore } = computeRawScore({
      attempts: [{ questionId: 'sj1', selectedOptionId: 'sj1-opt-0' }],
      questions,
    })
    expect(totalRawScore).toBe(0.5)
  })

  it('SJT: same polarity (C↔D) = 0.5 points', () => {
    const questions: QuestionMeta[] = [
      q('sj1', 'sj-stem', 'Situational Judgement', 'multiple_choice', 'sj1-opt-3', 4),
    ]
    const { totalRawScore } = computeRawScore({
      attempts: [{ questionId: 'sj1', selectedOptionId: 'sj1-opt-2' }],
      questions,
    })
    expect(totalRawScore).toBe(0.5)
  })

  it('SJT: wrong polarity = 0 points', () => {
    const questions: QuestionMeta[] = [
      q('sj1', 'sj-stem', 'Situational Judgement', 'multiple_choice', 'sj1-opt-0', 4),
    ]
    const { totalRawScore } = computeRawScore({
      attempts: [{ questionId: 'sj1', selectedOptionId: 'sj1-opt-2' }],
      questions,
    })
    expect(totalRawScore).toBe(0)
  })
})

describe('computeMaxRawScore', () => {
  it('syllogism stem = 2 max, default = 1 each', () => {
    const questions: QuestionMeta[] = [
      q('s1', 'stem1', 'DM', 'syllogism', 'x', 2),
      q('s2', 'stem1', 'DM', 'syllogism', 'x', 2),
      q('s3', 'stem1', 'DM', 'syllogism', 'x', 2),
      q('s4', 'stem1', 'DM', 'syllogism', 'x', 2),
      q('s5', 'stem1', 'DM', 'syllogism', 'x', 2),
      q('q1', 'stem2', 'VR', 'multiple_choice', 'x', 4),
    ]
    expect(computeMaxRawScore(questions)).toBe(3)
  })
})
