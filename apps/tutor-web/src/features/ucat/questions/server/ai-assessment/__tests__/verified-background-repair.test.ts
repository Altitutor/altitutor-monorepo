import {
  backgroundRepairPatchAllowed,
  verifiedRepairFormValuesFromSnapshot,
} from '@/features/ucat/questions/server/ai-assessment/verified-background-repair'
import type {
  UcatAssessmentPatch,
  UcatAssessmentSnapshot,
  UcatFormatCheck,
} from '@/features/ucat/questions/lib/ai-assessment/schema'

const questionId = '30000000-0000-4000-8000-000000000001'
const optionId = '40000000-0000-4000-8000-000000000001'

const snapshot = {
  stemId: '20000000-0000-4000-8000-000000000001',
  status: 'in_review',
  sectionId: '10000000-0000-4000-8000-000000000001',
  sectionName: 'Decision Making',
  sectionNumber: 2,
  displayColumns: 1,
  categoryId: null,
  categoryName: null,
  accessScope: 'public',
  stemText: {},
  stemTextPlain: 'Stem',
  images: [],
  questions: [{
    id: questionId,
    index: 1,
    questionText: {},
    questionTextPlain: 'Question',
    answerExplanation: null,
    answerExplanationPlain: '',
    questionType: 'multiple_choice',
    responseType: 'multiple_choice',
    answerScheme: 'single_choice',
    difficulty: null,
    timeBurdenSeconds: null,
    tagIds: [],
    tagNames: [],
    images: [],
    options: [{
      id: optionId,
      index: 1,
      answerText: {},
      answerTextPlain: 'A',
      answerExplanation: null,
      answerExplanationPlain: '',
      isAnswer: true,
      answerKeyValue: 'correct',
      images: [],
    }],
  }],
} satisfies UcatAssessmentSnapshot

function check(code: string): UcatFormatCheck {
  return {
    code,
    message: code,
    severity: 'error',
    scopeType: 'question',
    questionId,
    questionIndex: 1,
  }
}

function allowed(
  patch: UcatAssessmentPatch,
  formatChecks: UcatFormatCheck[],
  assessmentSnapshot: UcatAssessmentSnapshot = snapshot,
): boolean {
  return backgroundRepairPatchAllowed({ patch, snapshot: assessmentSnapshot, formatChecks })
}

describe('verified background repair policy', () => {
  it('preserves Most/Least keys and fails closed on a legacy-only snapshot', () => {
    const mostLeast = {
      ...snapshot,
      questions: [{
        ...snapshot.questions[0],
        answerScheme: 'situational_judgement_most_least' as const,
        options: [
          { ...snapshot.questions[0].options[0], answerKeyValue: 'most' as const },
          {
            ...snapshot.questions[0].options[0],
            id: '40000000-0000-4000-8000-000000000002',
            index: 2,
            isAnswer: false,
            answerKeyValue: 'least' as const,
          },
        ],
      }],
    } satisfies UcatAssessmentSnapshot

    expect(verifiedRepairFormValuesFromSnapshot(mostLeast).questions[0].options)
      .toMatchObject([{ answerKeyValue: 'most' }, { answerKeyValue: 'least' }])

    const legacyOnly = {
      ...snapshot,
      questions: snapshot.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => ({ ...option })),
      })),
    } as unknown as {
      questions: Array<Record<string, unknown> & { options: Array<Record<string, unknown>> }>
    }
    delete legacyOnly.questions[0].responseType
    expect(() => verifiedRepairFormValuesFromSnapshot(
      legacyOnly as unknown as UcatAssessmentSnapshot,
    )).toThrow('missing its canonical response contract')
  })

  it('allows missing explanations and missing options only when a matching gate failed', () => {
    const explanationPatch: UcatAssessmentPatch = {
      operation: 'set_text',
      target: { kind: 'question', id: questionId, field: 'answer_explanation' },
      beforeText: null,
      afterText: 'Worked explanation',
    }
    const optionPatch: UcatAssessmentPatch = {
      operation: 'insert_option',
      questionId,
      afterOptionId: optionId,
      option: { answerText: 'B', isAnswer: false },
    }
    expect(allowed(explanationPatch, [check('missing_question_explanation')])).toBe(true)
    expect(allowed(explanationPatch, [])).toBe(false)
    expect(allowed(optionPatch, [check('dm_assumption_option_count')])).toBe(true)
    expect(allowed(optionPatch, [check('missing_question_explanation')])).toBe(false)
  })

  it('always sends answer-key corrections through the independent verifier', () => {
    expect(allowed({
      operation: 'set_answer_key',
      questionId,
      currentCorrectOptionId: optionId,
      correctOptionId: optionId,
    }, [])).toBe(true)
  })

  it('initializes unset difficulty and time burden without overwriting existing estimates', () => {
    const difficultyPatch: UcatAssessmentPatch = {
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'difficulty',
      before: null,
      after: 0.5,
    }
    const timePatch: UcatAssessmentPatch = {
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'time_burden_seconds',
      before: null,
      after: 90,
    }
    expect(allowed(difficultyPatch, [])).toBe(true)
    expect(allowed(timePatch, [])).toBe(true)

    const populatedSnapshot = {
      ...snapshot,
      questions: [{ ...snapshot.questions[0], difficulty: 0.6, timeBurdenSeconds: 75 }],
    } satisfies UcatAssessmentSnapshot
    expect(allowed({ ...difficultyPatch, before: 0.6, after: 0.7 }, [], populatedSnapshot)).toBe(false)
    expect(allowed({ ...timePatch, before: 75, after: 80 }, [], populatedSnapshot)).toBe(false)
  })

  it('assigns valid supplied tags automatically when a question is untagged', () => {
    expect(allowed({
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'tag_ids',
      before: null,
      after: ['50000000-0000-4000-8000-000000000001'],
    }, [])).toBe(true)

    const taggedSnapshot = {
      ...snapshot,
      questions: [{ ...snapshot.questions[0], tagIds: ['existing-tag'] }],
    } satisfies UcatAssessmentSnapshot
    expect(allowed({
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'tag_ids',
      before: ['existing-tag'],
      after: ['replacement-tag'],
    }, [], taggedSnapshot)).toBe(false)
  })

  it('preserves the valid easiest endpoint and rejects invalid time replacements', () => {
    const zeroSnapshot = {
      ...snapshot,
      questions: [{ ...snapshot.questions[0], difficulty: 0, timeBurdenSeconds: 0 }],
    } satisfies UcatAssessmentSnapshot
    expect(allowed({
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'difficulty',
      before: 0,
      after: 0.4,
    }, [], zeroSnapshot)).toBe(false)
    expect(allowed({
      operation: 'set_metadata',
      targetKind: 'question',
      targetId: questionId,
      field: 'time_burden_seconds',
      before: 0,
      after: -1,
    }, [], zeroSnapshot)).toBe(false)
  })
})
